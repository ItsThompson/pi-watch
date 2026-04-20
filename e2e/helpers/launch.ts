import {
  test as base,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { _electron } from "playwright";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { SERVER_PORT } from "@pi-watch/shared";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const MAIN_ENTRY = join(REPO_ROOT, "desktop/dist/main.cjs");
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

export type AppFixtures = {
  tmpDir: string;
  electronApp: ElectronApplication;
  serverUrl: string;
  page: Page;
};

async function waitForServer(url: string, retries = 30): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) {return;}
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Server failed to start");
}

export function killPort(port: number): void {
  try {
    const pids = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      encoding: "utf8",
    }).trim();
    if (pids) {
      pids.split("\n").forEach((pid) => {
        process.kill(Number(pid), "SIGKILL");
      });
    }
  } catch {}
}

async function waitForTestHarness(app: ElectronApplication, retries = 30): Promise<void> {
  for (let i = 0; i < retries; i++) {
    const ready = await app.evaluate(async () => {
      return typeof (global as Record<string, unknown>).__piWatchTest !== "undefined";
    });
    if (ready) {return;}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("__piWatchTest harness not available");
}

export const test = base.extend<AppFixtures>({
  tmpDir: async ({}, use) => {
    const dir = await mkdtemp(join(tmpdir(), "pi-watch-e2e-"));
    await mkdir(join(dir, "Library", "Application Support", "PiWatch"), { recursive: true });
    await use(dir);
    await rm(dir, { recursive: true, force: true });
  },

  electronApp: async ({ tmpDir }, use) => {
    killPort(SERVER_PORT);
    const app = await _electron.launch({
      args: [MAIN_ENTRY],
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        HOME: tmpDir,
        USERPROFILE: tmpDir,
        PI_WATCH_TEST: "1",
      },
    });
    await waitForTestHarness(app);
    await use(app);
    killPort(SERVER_PORT);
    try {
      app.process().kill("SIGKILL");
    } catch {}
  },

  serverUrl: async ({}, use) => {
    await use(SERVER_URL);
  },

  page: async ({ electronApp, serverUrl }, use) => {
    await waitForServer(serverUrl);
    const page = await electronApp.firstWindow();
    await use(page);
  },
});

export { expect } from "@playwright/test";
export { REPO_ROOT, MAIN_ENTRY, SERVER_URL };
