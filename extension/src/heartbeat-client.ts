import { request as httpRequest } from "node:http";
import {
  SERVER_PORT,
  HEARTBEAT_INTERVAL_MS,
  FAILURE_THRESHOLD,
  BACKOFF_INTERVAL_MS,
} from "@pi-watch/shared";

interface HeartbeatSnapshot {
  sessionId: string;
  activity: string;
  lastEventTime: string;
  tmuxTarget: string | null;
  agentName?: string;
}

function post(path: string, body: unknown): Promise<boolean> {
  const data = JSON.stringify(body);
  return new Promise((resolve) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port: SERVER_PORT,
        path,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
        timeout: 2000,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode !== undefined && res.statusCode < 400);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end(data);
  });
}

export class HeartbeatClient {
  private timer: ReturnType<typeof setInterval> | null = null;
  private failures = 0;

  async register(body: {
    sessionId: string;
    pid: number;
    cwd: string;
    tmuxTarget: string | null;
    startTime: string;
    agentName?: string;
  }): Promise<void> {
    await post("/api/sessions/register", body);
  }

  startHeartbeats(getSnapshot: () => Promise<HeartbeatSnapshot> | HeartbeatSnapshot): void {
    this.stopHeartbeats();
    this.failures = 0;
    this.scheduleNext(getSnapshot);
  }

  private scheduleNext(getSnapshot: () => Promise<HeartbeatSnapshot> | HeartbeatSnapshot): void {
    const interval =
      this.failures >= FAILURE_THRESHOLD
        ? BACKOFF_INTERVAL_MS
        : HEARTBEAT_INTERVAL_MS;

    this.timer = setInterval(async () => {
      // Clear immediately so we can reschedule with potentially different interval
      if (this.timer) {clearInterval(this.timer);}
      this.timer = null;

      try {
        const snapshot = await getSnapshot();
        const ok = await post("/api/sessions/heartbeat", snapshot);
        if (ok) {
          this.failures = 0;
        } else {
          this.failures++;
        }
      } catch {
        this.failures++;
      }

      this.scheduleNext(getSnapshot);
    }, interval);

    this.timer.unref();
  }

  stopHeartbeats(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async unregister(sessionId: string): Promise<void> {
    await post("/api/sessions/unregister", { sessionId });
  }

  async postPermissionStart(sessionId: string): Promise<void> {
    await post(`/api/sessions/${sessionId}/permission-prompt-start`, {});
  }

  async postPermissionEnd(sessionId: string): Promise<void> {
    await post(`/api/sessions/${sessionId}/permission-prompt-end`, {});
  }
}
