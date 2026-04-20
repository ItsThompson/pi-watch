import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import { HEARTBEAT_EXPIRY_MS } from "@pi-watch/shared";
import { log } from "./utils/logger.js";
import { createSessionRegistry, type SessionRegistry } from "./session-registry.js";
import { createEventBus, type EventBus } from "./event-bus.js";
import { registerHealthRoute } from "./routes/health.js";
import { registerSessionRoutes } from "./routes/sessions.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerOpenTerminalRoute } from "./routes/open-terminal.js";
import { registerPermissionRoutes } from "./routes/permission-events.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createAppDeps() {
  const registry = createSessionRegistry({
    now: () => Date.now(),
    expiryMs: HEARTBEAT_EXPIRY_MS,
  });
  const bus = createEventBus();

  registry.onChange((kind, entry) => {
    bus.emit(
      `session:${kind}`,
      kind === "removed" ? { sessionId: entry.sessionId } : entry,
    );
  });

  return { registry, bus };
}

export async function buildServer(deps?: { registry: SessionRegistry; bus: EventBus }): Promise<{ server: FastifyInstance; registry: SessionRegistry; bus: EventBus }> {
  const { registry, bus } = deps ?? createAppDeps();

  const server = Fastify({
    ajv: { customOptions: { coerceTypes: false } },
  });

  server.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    log({
      timestamp: new Date().toISOString(),
      event: "server_error",
      error: error.message,
      statusCode,
    });
    reply.status(statusCode).send({ error: error.message, statusCode });
  });

  registerHealthRoute(server);
  registerSessionRoutes(server, registry);
  registerEventRoutes(server, bus);
  registerOpenTerminalRoute(server, registry);
  registerPermissionRoutes(server, registry);

  const clientDist =
    process.env.PI_WATCH_CLIENT_DIST ??
    resolve(__dirname, "../../client/dist");
  if (existsSync(clientDist)) {
    await server.register(fastifyStatic, {
      root: clientDist,
      prefix: "/",
      decorateReply: false,
    });
  }

  return { server, registry, bus };
}
