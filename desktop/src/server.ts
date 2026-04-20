import { fork, execSync, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import http from "node:http";
import { app } from "electron";
import { SERVER_PORT } from "@pi-watch/shared";
import { log } from "./utils/logger.js";

export const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

let child: ChildProcess | null = null;

export function killPortOccupant(): void {
  try {
    const pid = execSync(`lsof -ti tcp:${SERVER_PORT}`, {
      encoding: "utf8",
    }).trim();
    if (pid) {
      process.kill(Number(pid), "SIGKILL");
      log({
        timestamp: new Date().toISOString(),
        event: "killed_orphaned_process",
        pid: Number(pid),
        port: SERVER_PORT,
      });
    }
  } catch {
    // No process on port
  }
}

export function start(): void {
  const isPacked = app.isPackaged;
  const resourcesPath = isPacked
    ? resolve(process.resourcesPath, "server")
    : resolve(__dirname, "../../server");
  const serverEntry = resolve(resourcesPath, "dist/index.mjs");

  const env: Record<string, string> = { ...process.env as Record<string, string> };
  env.PI_WATCH_CHILD = "1";
  env.PI_WATCH_CLIENT_DIST = isPacked
    ? resolve(process.resourcesPath, "client/dist")
    : resolve(__dirname, "../../client/dist");

  child = fork(serverEntry, [], { stdio: "pipe", env });

  const pipe = (stream: "stdout" | "stderr") => {
    child?.[stream]?.on("data", (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) {
        try {
          const parsed = JSON.parse(line);
          log({ ...parsed, source: `server:${stream}` });
        } catch {
          log({
            timestamp: new Date().toISOString(),
            event: "server_raw_output",
            message: line,
          });
        }
      }
    });
  };
  pipe("stdout");
  pipe("stderr");

  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      log({ timestamp: new Date().toISOString(), event: "server_exited", code });
    }
  });
}

export function stop(): void {
  if (!child) return;
  const ref = child;
  child = null;
  ref.kill("SIGTERM");
  const timeout = setTimeout(() => {
    if (ref.exitCode === null && ref.signalCode === null) {
      ref.kill("SIGKILL");
    }
  }, 2000);
  ref.on("exit", () => clearTimeout(timeout));
}

export function waitForReady(retries = 30): Promise<void> {
  return new Promise((resolve, reject) => {
    const attempt = (remaining: number) => {
      http
        .get(`${SERVER_URL}/api/health`, (res) => {
          if (res.statusCode === 200) return resolve();
          retry(remaining);
        })
        .on("error", () => retry(remaining));
    };

    const retry = (remaining: number) => {
      if (remaining <= 0) return reject(new Error("Server failed to start"));
      setTimeout(() => attempt(remaining - 1), 200);
    };

    attempt(retries);
  });
}
