import type { ActivityStatus } from "@pi-watch/shared";
import { resolveSound, clearSession } from "./resolveSound";

describe("resolveSound", () => {
  let lastActivity: Map<string, ActivityStatus>;

  beforeEach(() => {
    lastActivity = new Map();
  });

  it("returns chime for first event when idle", () => {
    expect(resolveSound("s1", "idle", lastActivity)).toBe("chime");
  });

  it("returns beep for first event when processing", () => {
    expect(resolveSound("s1", "processing", lastActivity)).toBe("beep");
  });

  it("returns beep for first event when pending_approval", () => {
    expect(resolveSound("s1", "pending_approval", lastActivity)).toBe("beep");
  });

  it("returns null for duplicate same-state event", () => {
    resolveSound("s1", "idle", lastActivity);
    expect(resolveSound("s1", "idle", lastActivity)).toBeNull();
  });

  it("suppresses processing → running_tool transition", () => {
    resolveSound("s1", "processing", lastActivity);
    expect(resolveSound("s1", "running_tool", lastActivity)).toBeNull();
  });

  it("suppresses running_tool → processing transition", () => {
    resolveSound("s1", "running_tool", lastActivity);
    expect(resolveSound("s1", "processing", lastActivity)).toBeNull();
  });

  it("returns chime for processing → idle transition", () => {
    resolveSound("s1", "processing", lastActivity);
    expect(resolveSound("s1", "idle", lastActivity)).toBe("chime");
  });

  it("returns beep for idle → processing transition", () => {
    resolveSound("s1", "idle", lastActivity);
    expect(resolveSound("s1", "processing", lastActivity)).toBe("beep");
  });

  it("tracks sessions independently", () => {
    expect(resolveSound("s1", "idle", lastActivity)).toBe("chime");
    expect(resolveSound("s2", "idle", lastActivity)).toBe("chime");
  });

  it("handles full lifecycle: idle → processing → running_tool → processing → idle", () => {
    const results = [
      resolveSound("s1", "idle", lastActivity),
      resolveSound("s1", "processing", lastActivity),
      resolveSound("s1", "running_tool", lastActivity),
      resolveSound("s1", "processing", lastActivity),
      resolveSound("s1", "idle", lastActivity),
    ];
    expect(results).toEqual(["chime", "beep", null, null, "chime"]);
  });
});

describe("clearSession", () => {
  it("removes tracking so next event produces a sound", () => {
    const lastActivity = new Map<string, ActivityStatus>();
    resolveSound("s1", "idle", lastActivity);

    clearSession("s1", lastActivity);

    expect(resolveSound("s1", "idle", lastActivity)).toBe("chime");
  });
});
