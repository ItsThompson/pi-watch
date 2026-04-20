import { describe, it, expect, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { createSessionRegistry, type SessionRegistry } from "../session-registry.js";
import { registerOpenTerminalRoute } from "./open-terminal.js";
import { registerPermissionRoutes } from "./permission-events.js";
import { registerSessionRoutes } from "./sessions.js";

describe("Open-terminal route", () => {
  let server: FastifyInstance;
  let registry: SessionRegistry;

  beforeEach(async () => {
    server = Fastify();
    registry = createSessionRegistry({ now: () => Date.now(), expiryMs: 15_000 });
    registerSessionRoutes(server, registry);
    registerOpenTerminalRoute(server, registry);
    await server.ready();
  });

  it("returns session and tmuxTarget for a registered session with tmux", async () => {
    await server.inject({
      method: "POST",
      url: "/api/sessions/register",
      payload: { sessionId: "s1", pid: 1, cwd: "/tmp", tmuxTarget: "main:0.0", startTime: "2026-01-01T00:00:00Z" },
    });

    const res = await server.inject({
      method: "POST",
      url: "/api/open-terminal",
      payload: { sessionId: "s1" },
    });
    const body = res.json();
    expect(body.tmuxTarget).toBe("main:0.0");
    expect(body.session.sessionId).toBe("s1");
  });

  it("returns error for unknown session", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/open-terminal",
      payload: { sessionId: "unknown" },
    });
    expect(res.json()).toEqual({ error: "session not found" });
  });

  it("returns error for session without tmuxTarget", async () => {
    await server.inject({
      method: "POST",
      url: "/api/sessions/register",
      payload: { sessionId: "s1", pid: 1, cwd: "/tmp", tmuxTarget: null, startTime: "2026-01-01T00:00:00Z" },
    });

    const res = await server.inject({
      method: "POST",
      url: "/api/open-terminal",
      payload: { sessionId: "s1" },
    });
    expect(res.json()).toEqual({ error: "session was not started inside tmux" });
  });
});

describe("Permission routes", () => {
  let server: FastifyInstance;
  let registry: SessionRegistry;

  beforeEach(async () => {
    server = Fastify();
    registry = createSessionRegistry({ now: () => Date.now(), expiryMs: 15_000 });
    registerSessionRoutes(server, registry);
    registerPermissionRoutes(server, registry);
    await server.ready();
  });

  it("prompt-start transitions session to pending_approval", async () => {
    await server.inject({
      method: "POST",
      url: "/api/sessions/register",
      payload: { sessionId: "s1", pid: 1, cwd: "/tmp", tmuxTarget: "main:0.0", startTime: "2026-01-01T00:00:00Z" },
    });

    const res = await server.inject({
      method: "POST",
      url: "/api/sessions/s1/permission-prompt-start",
    });
    expect(res.json()).toEqual({ ok: true });

    const sessions = (await server.inject({ method: "GET", url: "/api/sessions" })).json();
    expect(sessions[0].activity).toBe("pending_approval");
  });

  it("prompt-end reverts session to running_tool", async () => {
    await server.inject({
      method: "POST",
      url: "/api/sessions/register",
      payload: { sessionId: "s1", pid: 1, cwd: "/tmp", tmuxTarget: "main:0.0", startTime: "2026-01-01T00:00:00Z" },
    });
    await server.inject({ method: "POST", url: "/api/sessions/s1/permission-prompt-start" });

    const res = await server.inject({
      method: "POST",
      url: "/api/sessions/s1/permission-prompt-end",
    });
    expect(res.json()).toEqual({ ok: true });

    const sessions = (await server.inject({ method: "GET", url: "/api/sessions" })).json();
    expect(sessions[0].activity).toBe("running_tool");
  });

  it("returns 404 for unknown session", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/sessions/unknown/permission-prompt-start",
    });
    expect(res.statusCode).toBe(404);
  });
});
