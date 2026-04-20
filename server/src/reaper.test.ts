import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createSessionRegistry, type SessionRegistry } from "./session-registry.js";
import { createReaper } from "./reaper.js";
import type { RegisteredSession } from "@pi-watch/shared";

describe("Reaper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reaps expired sessions on each interval tick", () => {
    const baseTime = 1000;
    let currentTime = baseTime;
    const registry = createSessionRegistry({ now: () => currentTime, expiryMs: 15_000 });
    const events: Array<{ kind: string; entry: RegisteredSession }> = [];
    registry.onChange((kind, entry) => events.push({ kind, entry }));

    registry.register({
      sessionId: "s1",
      pid: 1,
      cwd: "/tmp",
      tmuxTarget: null,
      startTime: new Date(baseTime).toISOString(),
      activity: "idle",
      lastSeen: new Date(baseTime).toISOString(),
      lastEventTime: new Date(baseTime).toISOString(),
    });
    events.length = 0;

    const reaper = createReaper({
      registry,
      intervalMs: 5_000,
      now: () => currentTime,
    });
    reaper.start();

    // first tick: not expired yet
    currentTime = baseTime + 14_000;
    vi.advanceTimersByTime(5_000);
    expect(registry.list()).toHaveLength(1);

    // second tick: expired
    currentTime = baseTime + 16_000;
    vi.advanceTimersByTime(5_000);
    expect(registry.list()).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("removed");

    reaper.stop();
  });

  it("stop prevents further reaping", () => {
    const baseTime = 1000;
    let currentTime = baseTime;
    const registry = createSessionRegistry({ now: () => currentTime, expiryMs: 15_000 });

    registry.register({
      sessionId: "s1",
      pid: 1,
      cwd: "/tmp",
      tmuxTarget: null,
      startTime: new Date(baseTime).toISOString(),
      activity: "idle",
      lastSeen: new Date(baseTime).toISOString(),
      lastEventTime: new Date(baseTime).toISOString(),
    });

    const reaper = createReaper({
      registry,
      intervalMs: 5_000,
      now: () => currentTime,
    });
    reaper.start();
    reaper.stop();

    currentTime = baseTime + 20_000;
    vi.advanceTimersByTime(10_000);
    expect(registry.list()).toHaveLength(1);
  });
});
