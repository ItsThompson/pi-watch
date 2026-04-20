import { test, expect } from "../helpers/launch.js";
import { spawnFakePi, type FakePi } from "../helpers/fake-pi-spawn.js";

test.describe("permission state transitions", () => {
  let fakePi: FakePi | undefined;

  test.afterEach(async () => {
    if (fakePi) {
      await fakePi.stop().catch(() => {});
      fakePi = undefined;
    }
  });

  test("AC-4: permission prompt toggles pending_approval state", async ({ page, serverUrl }) => {
    fakePi = await spawnFakePi({
      sessionId: "test-ac4",
      tmuxTarget: "main:0.0",
      cwd: "/tmp/test-ac4",
      serverUrl,
    });

    const row = page.locator("button", { hasText: "test-ac4" });
    await expect(row).toBeVisible({ timeout: 5000 });

    fakePi.send("permission-start");

    // Dot should turn pending color (#f85149)
    const dot = row.locator("span").first();
    await expect(dot).toHaveCSS("color", "rgb(248, 81, 73)", { timeout: 5000 });

    fakePi.send("permission-end");

    // Dot should revert from pending color
    await expect(dot).not.toHaveCSS("color", "rgb(248, 81, 73)", { timeout: 5000 });
  });
});
