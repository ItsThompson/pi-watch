import { describe, it, expect, beforeEach } from "vitest";
import { ActivityTracker } from "./activity-tracker.js";

describe("ActivityTracker", () => {
  let tracker: ActivityTracker;

  beforeEach(() => {
    tracker = new ActivityTracker();
  });

  it("starts with idle activity", () => {
    expect(tracker.snapshot().activity).toBe("idle");
  });

  it("transitions to processing on agent start", () => {
    tracker.onAgentStart();
    expect(tracker.snapshot().activity).toBe("processing");
  });

  it("transitions to running_tool on tool start", () => {
    tracker.onAgentStart();
    tracker.onToolStart();
    expect(tracker.snapshot().activity).toBe("running_tool");
  });

  it("stays running_tool when one of two tools ends", () => {
    tracker.onAgentStart();
    tracker.onToolStart();
    tracker.onToolStart();
    tracker.onToolEnd();
    expect(tracker.snapshot().activity).toBe("running_tool");
  });

  it("returns to processing when all tools end", () => {
    tracker.onAgentStart();
    tracker.onToolStart();
    tracker.onToolStart();
    tracker.onToolEnd();
    tracker.onToolEnd();
    expect(tracker.snapshot().activity).toBe("processing");
  });

  it("ignores tool end when counter is already zero", () => {
    tracker.onAgentStart();
    tracker.onToolEnd();
    expect(tracker.snapshot().activity).toBe("processing");
  });

  it("transitions to idle on agent end", () => {
    tracker.onAgentStart();
    tracker.onAgentEnd();
    expect(tracker.snapshot().activity).toBe("idle");
  });

  it("transitions to pending_approval on permission start", () => {
    tracker.onAgentStart();
    tracker.onToolStart();
    tracker.onPermissionStart();
    expect(tracker.snapshot().activity).toBe("pending_approval");
  });

  it("restores prior state on permission end", () => {
    tracker.onAgentStart();
    tracker.onToolStart();
    tracker.onPermissionStart();
    tracker.onPermissionEnd();
    expect(tracker.snapshot().activity).toBe("running_tool");
  });

  it("handles nested permission starts correctly", () => {
    tracker.onAgentStart();
    tracker.onPermissionStart();
    tracker.onPermissionStart();
    tracker.onPermissionEnd();
    expect(tracker.snapshot().activity).toBe("pending_approval");
    tracker.onPermissionEnd();
    expect(tracker.snapshot().activity).toBe("processing");
  });

  it("updates lastEventTime on every transition", async () => {
    const t1 = tracker.snapshot().lastEventTime;
    await new Promise((r) => setTimeout(r, 5));
    tracker.onAgentStart();
    const t2 = tracker.snapshot().lastEventTime;
    expect(new Date(t2).getTime()).toBeGreaterThan(new Date(t1).getTime());
  });
});
