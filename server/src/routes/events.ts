import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { EventBus } from "../event-bus.js";

export function registerEventRoutes(
  server: FastifyInstance,
  bus: EventBus,
): void {
  server.get("/api/events", (request: FastifyRequest, reply: FastifyReply) => {
    reply.hijack();
    bus.sseReply(reply);

    const keepalive = setInterval(() => {
      reply.raw.write(":\n\n");
    }, 15_000);

    request.raw.on("close", () => clearInterval(keepalive));
  });
}
