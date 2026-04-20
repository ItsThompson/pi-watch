import { describe, it, expect } from "vitest";
import { applyVisualState } from "./window.js";

describe("applyVisualState", () => {
  it("returns hidden state when not visible and ghost disabled", () => {
    const result = applyVisualState({ visible: false, ghostEnabled: false, ghostOpacity: 0.3 });
    expect(result).toEqual({ opacity: 0, ignoreMouse: true });
  });

  it("returns hidden state when not visible and ghost enabled", () => {
    const result = applyVisualState({ visible: false, ghostEnabled: true, ghostOpacity: 0.3 });
    expect(result).toEqual({ opacity: 0, ignoreMouse: true });
  });

  it("returns full opacity when visible and ghost disabled", () => {
    const result = applyVisualState({ visible: true, ghostEnabled: false, ghostOpacity: 0.3 });
    expect(result).toEqual({ opacity: 1, ignoreMouse: false });
  });

  it("returns ghost opacity when visible and ghost enabled", () => {
    const result = applyVisualState({ visible: true, ghostEnabled: true, ghostOpacity: 0.3 });
    expect(result).toEqual({ opacity: 0.3, ignoreMouse: true });
  });

  it("uses custom ghost opacity value", () => {
    const result = applyVisualState({ visible: true, ghostEnabled: true, ghostOpacity: 0.7 });
    expect(result).toEqual({ opacity: 0.7, ignoreMouse: true });
  });
});
