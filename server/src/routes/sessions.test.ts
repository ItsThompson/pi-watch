import { describe, it, expect, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createSessionRegistry, type SessionRegistry } from "../session-registry.js";
import { registerSessionRoutes } from "./sessions.js";
import type { RegisteredSession } from "@pi-watch/shared";

describe("Session routes", () => {
  let server: FastifyInstance;
  let registry: SessionRegistry;
  let events: Array<{ kind: string; entry: RegisteredSession }>;

  beforeEach(async () => {
    server = Fastify();
    registry = createSessionRegistry({ now: () => Date.now(), expiryMs: 15_000 });
    events = [];
    registry.onChange((kind, entry) => events.push({ kind, entry }));
    registerSessionRoutes(server, registry);
    await server.ready();
  });

  const registerPayload = {
    sessionId: "s1",
    pid: 1234,
    cwd: "/tmp",
    tmuxTarget: "main:0.0",
    startTime: "2026-01-01T00:00:00Z",
  };

  it("given empty registry, POST register then GET sessions returns the entry", async () => {
    const regRes = await server.inject({
      method: "POST",
      url: "/api/sessions/register",
      payload: registerPayload,
    });
    expect(regRes.statusCode).toBe(200);
    expect(regRes.json()).toEqual({ ok: true });

    const listRes = await server.inject({ method: "GET", url: "/api/sessions" });
    const sessions = listRes.json();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe("s1");
    expect(sessions[0].activity).toBe("idle");
  });

  it("given registered session, heartbeat with same activity fires no updated event", async () => {
    await server.inject({ method: "POST", url: "/api/sessions/register", payload: registerPayload });
    events.length = 0;

    await server.inject({
      method: "POST",
      url: "/api/sessions/heartbeat",
      payload: { sessionId: "s1", activity: "idle", lastEventTime: "2026-01-01T00:00:00Z" },
    });

    const updated = events.filter((e) => e.kind === "updated");
    expect(updated).toHaveLength(0);
  });

  it("given registered session, heartbeat with different activity fires updated event", async () => {
    await server.inject({ method: "POST", url: "/api/sessions/register", payload: registerPayload });
    events.length = 0;

    await server.inject({
      method: "POST",
      url: "/api/sessions/heartbeat",
      payload: { sessionId: "s1", activity: "processing", lastEventTime: "2026-01-01T00:01:00Z" },
    });

    const updated = events.filter((e) => e.kind === "updated");
    expect(updated).toHaveLength(1);
    expect(updated[0].entry.activity).toBe("processing");
  });

  it("given registered session, POST unregister then GET sessions returns empty", async () => {
    await server.inject({ method: "POST", url: "/api/sessions/register", payload: registerPayload });

    await server.inject({
      method: "POST",
      url: "/api/sessions/unregister",
      payload: { sessionId: "s1" },
    });

    const listRes = await server.inject({ method: "GET", url: "/api/sessions" });
    expect(listRes.json()).toHaveLength(0);
  });

  it("returns 400 when zod validation fails", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/sessions/register",
      payload: { bad: "data" },
    });
    expect(res.statusCode).toBe(400);
  });
});
