import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { SessionRegistry } from "../session-registry.js";

export function registerPermissionRoutes(
  server: FastifyInstance,
  registry: SessionRegistry,
): void {
  server.post("/api/sessions/:id/permission-prompt-start", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const session = registry.get(id);
    if (!session) {
      reply.status(404).send({ error: "session not found" });
      return;
    }
    // Transition to pending_approval via heartbeat so onChange fires
    registry.heartbeat({
      sessionId: id,
      activity: "pending_approval",
      lastEventTime: new Date().toISOString(),
    });
    return { ok: true };
  });

  server.post("/api/sessions/:id/permission-prompt-end", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const session = registry.get(id);
    if (!session) {
      reply.status(404).send({ error: "session not found" });
      return;
    }
    // Revert to running_tool; the extension's next heartbeat will correct
    // the activity within 5s if the actual state differs.
    registry.heartbeat({
      sessionId: id,
      activity: "running_tool",
      lastEventTime: new Date().toISOString(),
    });
    return { ok: true };
  });
}
