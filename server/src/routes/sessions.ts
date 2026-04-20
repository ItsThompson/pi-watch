import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { SessionRegistry } from "../session-registry.js";
import {
  registerBodySchema,
  heartbeatBodySchema,
  unregisterBodySchema,
  type RegisterBody,
  type HeartbeatBody,
  type UnregisterBody,
} from "../schemas.js";

function zodParse<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: unknown } }, data: unknown, reply: FastifyReply): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    reply.status(400).send({ error: "validation failed", details: result.error });
    return null;
  }
  return result.data as T;
}

export function registerSessionRoutes(
  server: FastifyInstance,
  registry: SessionRegistry,
): void {
  server.post("/api/sessions/register", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = zodParse<RegisterBody>(registerBodySchema, request.body, reply);
    if (!body) return;

    registry.register({
      sessionId: body.sessionId,
      pid: body.pid,
      cwd: body.cwd,
      tmuxTarget: body.tmuxTarget,
      startTime: body.startTime,
      activity: "idle",
      lastSeen: new Date().toISOString(),
      lastEventTime: body.startTime,
      agentName: body.agentName,
    });
    return { ok: true };
  });

  server.post("/api/sessions/heartbeat", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = zodParse<HeartbeatBody>(heartbeatBodySchema, request.body, reply);
    if (!body) return;

    registry.heartbeat(body);
    return { ok: true };
  });

  server.post("/api/sessions/unregister", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = zodParse<UnregisterBody>(unregisterBodySchema, request.body, reply);
    if (!body) return;

    registry.unregister(body.sessionId);
    return { ok: true };
  });

  server.get("/api/sessions", async () => registry.list());
}
