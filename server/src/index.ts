import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyError } from "fastify";
import fastifyStatic from "@fastify/static";
import { SERVER_PORT } from "@pi-watch/shared";
import { log } from "./utils/logger.js";
import { registerHealthRoute } from "./routes/health.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildServer() {
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

  return server;
}

async function start(): Promise<void> {
  const server = await buildServer();

  await server.listen({ port: SERVER_PORT, host: "127.0.0.1" });
  log({
    timestamp: new Date().toISOString(),
    event: "server_started",
    port: SERVER_PORT,
  });

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  if (process.stdin?.readable) {
    process.stdin.resume();
    process.stdin.on("end", shutdown);
  }
}

start().catch((error) => {
  log({
    timestamp: new Date().toISOString(),
    event: "server_start_failed",
    error: String(error),
  });
  process.exit(1);
});
