import { test, expect } from "../helpers/launch.js";
import { spawnFakePi, type FakePi } from "../helpers/fake-pi-spawn.js";

test.describe("session list", () => {
  let fakePi: FakePi | undefined;

  test.afterEach(async () => {
    if (fakePi) {
      await fakePi.stop().catch(() => {});
      fakePi = undefined;
    }
  });

  test("AC-1: new session appears within 5s", async ({ page, serverUrl }) => {
    fakePi = await spawnFakePi({
      sessionId: "test-ac1",
      tmuxTarget: "main:0.0",
      serverUrl,
    });

    await expect(page.locator(`text=test-ac1`)).toBeVisible({ timeout: 5000 });
  });

  test("AC-2: stopped heartbeat removes session within 20s", async ({ page, serverUrl }) => {
    fakePi = await spawnFakePi({
      sessionId: "test-ac2",
      tmuxTarget: "main:0.0",
      serverUrl,
    });

    await expect(page.locator(`text=test-ac2`)).toBeVisible({ timeout: 5000 });

    fakePi.send("stop-heartbeat");

    await expect(page.locator(`text=test-ac2`)).not.toBeVisible({ timeout: 20000 });
  });

  test("AC-3: unregister removes session immediately", async ({ page, serverUrl }) => {
    fakePi = await spawnFakePi({
      sessionId: "test-ac3",
      tmuxTarget: "main:0.0",
      serverUrl,
    });

    await expect(page.locator(`text=test-ac3`)).toBeVisible({ timeout: 5000 });

    fakePi.send("unregister");

    await expect(page.locator(`text=test-ac3`)).not.toBeVisible({ timeout: 2000 });
  });
});
