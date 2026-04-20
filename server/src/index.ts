import { SERVER_PORT, HEARTBEAT_INTERVAL_MS } from "@pi-watch/shared";
import { log } from "./utils/logger.js";
import { createReaper } from "./reaper.js";
import { buildServer } from "./server.js";

async function start(): Promise<void> {
  const { server, registry } = await buildServer();

  const reaper = createReaper({
    registry,
    intervalMs: HEARTBEAT_INTERVAL_MS,
    now: () => Date.now(),
  });
  reaper.start();

  await server.listen({ port: SERVER_PORT, host: "127.0.0.1" });
  log({
    timestamp: new Date().toISOString(),
    event: "server_started",
    port: SERVER_PORT,
  });

  const shutdown = async () => {
    reaper.stop();
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // When spawned by Electron with stdio: "pipe", stdin closes if the parent
  // dies unexpectedly. Step 6 wires this via PI_WATCH_CHILD env var.
  if (process.env.PI_WATCH_CHILD && process.stdin?.readable) {
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
