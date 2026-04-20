import { test, expect } from "../helpers/launch.js";

test.describe("window toggles", () => {
  test("AC-5: toggleWindow toggles visibility", async ({ electronApp }) => {
    // Window starts visible after app.ready → showWindow()
    const initial = await electronApp.evaluate(async ({ app }) => {
      const harness = (global as Record<string, any>).__piWatchTest;
      return harness.getState();
    });
    expect(initial.visible).toBe(true);

    // Toggle off
    await electronApp.evaluate(async () => {
      const harness = (global as Record<string, any>).__piWatchTest;
      harness.toggleWindow();
    });
    const afterHide = await electronApp.evaluate(async () => {
      const harness = (global as Record<string, any>).__piWatchTest;
      return harness.getState();
    });
    expect(afterHide.visible).toBe(false);

    // Toggle on
    await electronApp.evaluate(async () => {
      const harness = (global as Record<string, any>).__piWatchTest;
      harness.toggleWindow();
    });
    const afterShow = await electronApp.evaluate(async () => {
      const harness = (global as Record<string, any>).__piWatchTest;
      return harness.getState();
    });
    expect(afterShow.visible).toBe(true);
  });

  test("AC-6: toggleGhost enables ghost mode", async ({ electronApp }) => {
    await electronApp.evaluate(async () => {
      const harness = (global as Record<string, any>).__piWatchTest;
      harness.toggleGhost();
    });

    const state = await electronApp.evaluate(async () => {
      const harness = (global as Record<string, any>).__piWatchTest;
      return harness.getState();
    });

    expect(state.ghostEnabled).toBe(true);
    expect(state.ghostOpacityValue).toBe(0.3);
  });
});
