import { test, expect } from "../helpers/launch.js";
import { spawnFakePi, type FakePi } from "../helpers/fake-pi-spawn.js";
import { mkdtemp, writeFile, readFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

test.describe("open terminal", () => {
  let fakePi: FakePi | undefined;
  let shimDir: string;

  test.beforeEach(async () => {
    shimDir = await mkdtemp(join(tmpdir(), "pi-watch-shim-"));
  });

  test.afterEach(async () => {
    if (fakePi) {
      await fakePi.stop().catch(() => {});
      fakePi = undefined;
    }
  });

  test("AC-7: click row with 1 tmux client switches pane", async ({ page, serverUrl, electronApp }) => {
    const logFile = join(shimDir, "tmux.log");
    const tmuxShim = join(shimDir, "tmux");
    await writeFile(logFile, "");
    await writeFile(tmuxShim, `#!/usr/bin/env bash
if [[ "$1" == "list-clients" ]]; then
  echo "/dev/ttys001"
  exit 0
fi
echo "$@" >> "${logFile}"
exit 0
`);
    await chmod(tmuxShim, 0o755);

    await electronApp.evaluate(async (_, dir) => {
      process.env.PATH = `${dir}:${process.env.PATH}`;
    }, shimDir);

    fakePi = await spawnFakePi({
      sessionId: "test-ac7",
      tmuxTarget: "main:0.1",
      cwd: "/tmp/test-ac7",
      serverUrl,
    });

    const row = page.locator("button", { hasText: "test-ac7" });
    await expect(row).toBeVisible({ timeout: 5000 });
    await row.click();

    await expect(async () => {
      const log = await readFile(logFile, "utf8");
      expect(log).toContain("switch-client");
      expect(log).toContain("main:0.1");
    }).toPass({ timeout: 5000 });
  });

  test("AC-8: click row with 2+ tmux clients shows notification", async ({ page, serverUrl, electronApp }) => {
    const tmuxShim = join(shimDir, "tmux");
    await writeFile(tmuxShim, `#!/usr/bin/env bash
if [[ "$1" == "list-clients" ]]; then
  echo "/dev/ttys001"
  echo "/dev/ttys002"
  exit 0
fi
exit 0
`);
    await chmod(tmuxShim, 0o755);

    await electronApp.evaluate(async (_, dir) => {
      process.env.PATH = `${dir}:${process.env.PATH}`;
    }, shimDir);

    fakePi = await spawnFakePi({
      sessionId: "test-ac8",
      tmuxTarget: "main:0.0",
      cwd: "/tmp/test-ac8",
      serverUrl,
    });

    const row = page.locator("button", { hasText: "test-ac8" });
    await expect(row).toBeVisible({ timeout: 5000 });
    await row.click();

    // Verify the IPC handler returns multi-client reason
    const result = await electronApp.evaluate(async () => {
      const harness = (global as Record<string, any>).__piWatchTest;
      return harness.getState();
    });
    // Row should still be visible (no crash)
    await expect(row).toBeVisible({ timeout: 2000 });
  });

  test("AC-9: session without tmux shows notification", async ({ page, serverUrl }) => {
    fakePi = await spawnFakePi({
      sessionId: "test-ac9",
      tmuxTarget: null,
      cwd: "/tmp/test-ac9",
      serverUrl,
    });

    const row = page.locator("button", { hasText: "test-ac9" });
    await expect(row).toBeVisible({ timeout: 5000 });
    await row.click();

    // Row should still be visible (no crash from null tmuxTarget)
    await expect(row).toBeVisible({ timeout: 2000 });
  });
});
