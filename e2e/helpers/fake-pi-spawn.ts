import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { SERVER_PORT } from "@pi-watch/shared";

const FIXTURE_PATH = resolve(import.meta.dirname, "../fixtures/fake-pi.ts");
const REPO_ROOT = resolve(import.meta.dirname, "../..");
const TSX_PATH = resolve(REPO_ROOT, "node_modules/.bin/tsx");

export interface FakePi {
  send(command: string): void;
  stop(): Promise<void>;
  sessionId: string;
}

export function spawnFakePi(opts: {
  sessionId: string;
  tmuxTarget?: string | null;
  cwd?: string;
  serverUrl?: string;
}): Promise<FakePi> {
  const serverUrl = opts.serverUrl ?? `http://127.0.0.1:${SERVER_PORT}`;
  const child: ChildProcess = spawn(TSX_PATH, [FIXTURE_PATH], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      FAKE_PI_SESSION_ID: opts.sessionId,
      FAKE_PI_CWD: opts.cwd ?? process.cwd(),
      FAKE_PI_TMUX_TARGET: opts.tmuxTarget ?? "null",
      FAKE_PI_URL: serverUrl,
    },
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("fake-pi did not start")), 5000);

    child.stdout?.setEncoding("utf8");
    child.stdout?.once("data", (data: string) => {
      clearTimeout(timeout);
      if (data.trim() === "ready") {
        resolve({
          sessionId: opts.sessionId,
          send(command: string) {
            child.stdin?.write(`${command}\n`);
          },
          async stop() {
            child.stdin?.end();
            await new Promise<void>((res) => {
              child.on("exit", () => res());
              setTimeout(() => {
                try { child.kill("SIGKILL"); } catch {}
                res();
              }, 2000);
            });
          },
        });
      } else {
        reject(new Error(`fake-pi failed: ${data.trim()}`));
      }
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
