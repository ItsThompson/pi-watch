import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { SessionRegistry } from "../session-registry.js";
import { openTerminalBodySchema } from "../schemas.js";

export function resolveOpenTarget(registry: SessionRegistry, sessionId: string) {
  const session = registry.get(sessionId);
  if (!session) return { error: "session not found" };
  if (!session.tmuxTarget) return { error: "session was not started inside tmux" };
  return { session, tmuxTarget: session.tmuxTarget };
}

export function registerOpenTerminalRoute(
  server: FastifyInstance,
  registry: SessionRegistry,
): void {
  server.post("/api/open-terminal", async (request: FastifyRequest, reply: FastifyReply) => {
    const result = openTerminalBodySchema.safeParse(request.body);
    if (!result.success) {
      reply.status(400).send({ error: "validation failed" });
      return;
    }
    return resolveOpenTarget(registry, result.data.sessionId);
  });
}
