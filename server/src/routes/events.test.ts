import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import Fastify, { type FastifyInstance } from "fastify";
import { createSessionRegistry, type SessionRegistry } from "../session-registry.js";
import { createEventBus, type EventBus } from "../event-bus.js";
import { registerSessionRoutes } from "./sessions.js";
import { registerEventRoutes } from "./events.js";

function connectSSE(port: number): Promise<{ messages: Array<{ event: string; data: string }>; req: http.ClientRequest }> {
  return new Promise((resolve) => {
    const messages: Array<{ event: string; data: string }> = [];
    const req = http.get(`http://127.0.0.1:${port}/api/events`, (res) => {
      let buffer = "";
      res.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const parts = buffer.split("\n\n");
        buffer = parts.pop()!;
        parts.forEach((part) => {
          const eventMatch = part.match(/^event: (.+)$/m);
          const dataMatch = part.match(/^data: (.+)$/m);
          if (eventMatch && dataMatch) {
            messages.push({ event: eventMatch[1], data: dataMatch[1] });
          }
        });
      });
      resolve({ messages, req });
    });
  });
}

describe("SSE events endpoint", () => {
  let server: FastifyInstance;
  let registry: SessionRegistry;
  let bus: EventBus;
  let port: number;
  let sseReq: http.ClientRequest | undefined;

  beforeEach(async () => {
    server = Fastify({ forceCloseConnections: true });
    registry = createSessionRegistry({ now: () => Date.now(), expiryMs: 15_000 });
    bus = createEventBus();
    registry.onChange((kind, entry) => {
      bus.emit(`session:${kind}`, kind === "removed" ? { sessionId: entry.sessionId } : entry);
    });
    registerSessionRoutes(server, registry);
    registerEventRoutes(server, bus);
    await server.listen({ port: 0, host: "127.0.0.1" });
    const addr = server.server.address();
    port = typeof addr === "object" && addr ? addr.port : 0;
  });

  afterEach(async () => {
    sseReq?.destroy();
    await server.close();
  });

  it("POST register emits session:added SSE frame", async () => {
    const sse = await connectSSE(port);
    sseReq = sse.req;

    await new Promise((resolve) => setTimeout(resolve, 50));

    const res = await server.inject({
      method: "POST",
      url: "/api/sessions/register",
      payload: {
        sessionId: "s1",
        pid: 1234,
        cwd: "/tmp",
        tmuxTarget: "main:0.0",
        startTime: "2026-01-01T00:00:00Z",
      },
    });
    expect(res.statusCode).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(sse.messages.length).toBeGreaterThanOrEqual(1);
    expect(sse.messages[0].event).toBe("session:added");
    const data = JSON.parse(sse.messages[0].data);
    expect(data.sessionId).toBe("s1");
  });
});
