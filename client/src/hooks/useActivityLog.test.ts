import { renderHook, act } from "@testing-library/react";
import { MockEventSource } from "../test-setup";
import { useActivityLog } from "./useActivityLog";

describe("useActivityLog", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("given 12 SSE events, only the most recent 10 remain", () => {
    const { result } = renderHook(() => useActivityLog());
    const es = MockEventSource.instances[0];

    act(() => {
      Array.from({ length: 12 }, (_, i) =>
        es.emit("session:added", {
          sessionId: `s${i}`,
          pid: 1,
          cwd: "/tmp",
          tmuxTarget: null,
          startTime: "2026-01-01T00:00:00Z",
          activity: "idle",
          lastSeen: "2026-01-01T00:00:00Z",
          lastEventTime: "2026-01-01T00:00:00Z",
        }),
      );
    });

    expect(result.current.entries).toHaveLength(10);
  });

  it("given an entry, when dismiss timer fires, then it is removed", () => {
    const { result } = renderHook(() => useActivityLog());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit("session:added", {
        sessionId: "s1",
        pid: 1,
        cwd: "/tmp",
        tmuxTarget: null,
        startTime: "2026-01-01T00:00:00Z",
        activity: "idle",
        lastSeen: "2026-01-01T00:00:00Z",
        lastEventTime: "2026-01-01T00:00:00Z",
      });
    });

    expect(result.current.entries).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.entries).toHaveLength(0);
  });
});
