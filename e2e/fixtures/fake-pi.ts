import http from "node:http";
import { SERVER_PORT } from "@pi-watch/shared";

const BASE_URL = process.env.FAKE_PI_URL ?? `http://127.0.0.1:${SERVER_PORT}`;
const SESSION_ID = process.env.FAKE_PI_SESSION_ID ?? `fake-${Date.now()}`;
const CWD = process.env.FAKE_PI_CWD ?? process.cwd();
const TMUX_RAW = process.env.FAKE_PI_TMUX_TARGET ?? "null";
const TMUX_TARGET = TMUX_RAW === "null" ? null : TMUX_RAW;

let activity = "idle";
let running = true;
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

function post(path: string, body: Record<string, unknown>): Promise<number> {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      timeout: 2000,
    }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end(data);
  });
}

async function register(): Promise<void> {
  await post("/api/sessions/register", {
    sessionId: SESSION_ID,
    pid: process.pid,
    cwd: CWD,
    tmuxTarget: TMUX_TARGET,
    startTime: new Date().toISOString(),
  });
}

async function heartbeat(): Promise<void> {
  await post("/api/sessions/heartbeat", {
    sessionId: SESSION_ID,
    activity,
    lastEventTime: new Date().toISOString(),
    tmuxTarget: TMUX_TARGET,
  });
}

async function unregister(): Promise<void> {
  await post("/api/sessions/unregister", { sessionId: SESSION_ID });
}

async function permissionStart(): Promise<void> {
  await post(`/api/sessions/${SESSION_ID}/permission-prompt-start`, {});
}

async function permissionEnd(): Promise<void> {
  await post(`/api/sessions/${SESSION_ID}/permission-prompt-end`, {});
}

function startHeartbeat(): void {
  heartbeatTimer = setInterval(async () => {
    try { await heartbeat(); } catch { /* swallow */ }
  }, 5000);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk: string) => {
  const lines = chunk.trim().split("\n");
  for (const line of lines) {
    const cmd = line.trim();
    if (cmd.startsWith("activity ")) {
      activity = cmd.slice(9).trim();
      try { await heartbeat(); } catch { /* swallow */ }
    } else if (cmd === "permission-start") {
      try { await permissionStart(); } catch { /* swallow */ }
    } else if (cmd === "permission-end") {
      try { await permissionEnd(); } catch { /* swallow */ }
    } else if (cmd === "unregister") {
      try { await unregister(); } catch { /* swallow */ }
      stopHeartbeat();
      running = false;
      process.exit(0);
    } else if (cmd === "stop-heartbeat") {
      stopHeartbeat();
    }
  }
});

process.stdin.on("end", () => {
  stopHeartbeat();
  process.exit(0);
});

(async () => {
  try {
    await register();
    startHeartbeat();
    process.stdout.write("ready\n");
  } catch {
    process.stdout.write("error\n");
    process.exit(1);
  }
})();
