import { describe, it, expect, beforeEach } from "vitest";
import { createSessionRegistry } from "./session-registry.js";
import type { RegisteredSession } from "@pi-watch/shared";

function makeEntry(overrides: Partial<RegisteredSession> = {}): RegisteredSession {
  return {
    sessionId: "s1",
    pid: 1234,
    cwd: "/tmp",
    tmuxTarget: "main:0.0",
    startTime: "2026-01-01T00:00:00Z",
    activity: "idle",
    lastSeen: "2026-01-01T00:00:00Z",
    lastEventTime: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("SessionRegistry", () => {
  let clock: { now: number };
  let registry: ReturnType<typeof createSessionRegistry>;
  let events: Array<{ kind: string; entry: RegisteredSession }>;

  beforeEach(() => {
    clock = { now: 1000 };
    registry = createSessionRegistry({
      now: () => clock.now,
      expiryMs: 15_000,
    });
    events = [];
    registry.onChange((kind, entry) => {
      events.push({ kind, entry });
    });
  });

  it("register stores entry and fires onChange added exactly once", () => {
    const entry = makeEntry();
    registry.register(entry);

    expect(registry.list()).toHaveLength(1);
    expect(registry.list()[0]).toEqual({ ...entry, lastSeen: expect.any(String) });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("added");
  });

  it("heartbeat for unknown id upserts a new entry", () => {
    registry.heartbeat({
      sessionId: "unknown",
      activity: "processing",
      lastEventTime: "2026-01-01T00:01:00Z",
    });

    expect(registry.list()).toHaveLength(1);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("added");
    expect(events[0].entry.sessionId).toBe("unknown");
    expect(events[0].entry.activity).toBe("processing");
  });

  it("heartbeat updates lastSeen but only fires updated when activity changes", () => {
    registry.register(makeEntry({ activity: "idle" }));
    events.length = 0;

    clock.now = 2000;
    registry.heartbeat({
      sessionId: "s1",
      activity: "idle",
      lastEventTime: "2026-01-01T00:00:00Z",
    });
    expect(events).toHaveLength(0);

    registry.heartbeat({
      sessionId: "s1",
      activity: "processing",
      lastEventTime: "2026-01-01T00:01:00Z",
    });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("updated");
    expect(events[0].entry.activity).toBe("processing");
  });

  it("heartbeat with new tmuxTarget updates stored entry silently", () => {
    registry.register(makeEntry({ tmuxTarget: "main:0.0" }));
    events.length = 0;

    registry.heartbeat({
      sessionId: "s1",
      activity: "idle",
      lastEventTime: "2026-01-01T00:00:00Z",
      tmuxTarget: "main:1.0",
    });

    expect(events).toHaveLength(0);
    expect(registry.list()[0].tmuxTarget).toBe("main:1.0");
  });

  it("unregister removes entry and fires onChange removed", () => {
    registry.register(makeEntry());
    events.length = 0;

    registry.unregister("s1");

    expect(registry.list()).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("removed");
    expect(events[0].entry.sessionId).toBe("s1");
  });

  it("reap removes expired entries and fires removed per entry", () => {
    registry.register(makeEntry({ sessionId: "s1" }));
    registry.register(makeEntry({ sessionId: "s2" }));
    events.length = 0;

    // advance past expiry
    registry.reap(clock.now + 16_000);

    expect(registry.list()).toHaveLength(0);
    expect(events).toHaveLength(2);
    events.forEach((event) => expect(event.kind).toBe("removed"));
  });

  it("list returns snapshot sorted by lastEventTime desc", () => {
    registry.register(makeEntry({ sessionId: "old", lastEventTime: "2026-01-01T00:00:00Z" }));
    registry.register(makeEntry({ sessionId: "new", lastEventTime: "2026-01-01T00:05:00Z" }));

    const list = registry.list();
    expect(list[0].sessionId).toBe("new");
    expect(list[1].sessionId).toBe("old");
  });

  it("clock injection lets tests advance time deterministically", () => {
    registry.register(makeEntry());
    events.length = 0;

    // not expired yet
    registry.reap(clock.now + 14_999);
    expect(registry.list()).toHaveLength(1);

    // exactly at expiry boundary
    registry.reap(clock.now + 15_001);
    expect(registry.list()).toHaveLength(0);
    expect(events).toHaveLength(1);
  });
});
