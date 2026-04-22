import { renderHook, act } from "@testing-library/react";
import { MockEventSource } from "../test-setup";
import { useActivitySounds } from "./useActivitySounds";
import * as notifications from "./notifications";

vi.mock("./notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof notifications>();
  return {
    ...actual,
    playNotificationSound: vi.fn(),
  };
});

const mockPlay = vi.mocked(notifications.playNotificationSound);

function makeSessionData(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "s1",
    pid: 1,
    cwd: "/tmp",
    tmuxTarget: null,
    startTime: "2026-01-01T00:00:00Z",
    activity: "idle",
    lastSeen: "2026-01-01T00:00:00Z",
    lastEventTime: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("useActivitySounds", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    mockPlay.mockClear();
    delete (window as Record<string, unknown>).piWatch;
  });

  it("plays chime on session:added with idle activity", () => {
    renderHook(() => useActivitySounds());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit("session:added", makeSessionData({ activity: "idle" }));
    });

    expect(mockPlay).toHaveBeenCalledWith("chime");
  });

  it("plays beep on session:updated with processing activity", () => {
    renderHook(() => useActivitySounds());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit("session:added", makeSessionData({ activity: "idle" }));
    });
    mockPlay.mockClear();

    act(() => {
      es.emit("session:updated", makeSessionData({ activity: "processing" }));
    });

    expect(mockPlay).toHaveBeenCalledWith("beep");
  });

  it("suppresses processing → running_tool transition", () => {
    renderHook(() => useActivitySounds());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit("session:added", makeSessionData({ activity: "processing" }));
    });
    mockPlay.mockClear();

    act(() => {
      es.emit("session:updated", makeSessionData({ activity: "running_tool" }));
    });

    expect(mockPlay).not.toHaveBeenCalled();
  });

  it("plays chime on processing → idle transition", () => {
    renderHook(() => useActivitySounds());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit("session:added", makeSessionData({ activity: "processing" }));
    });
    mockPlay.mockClear();

    act(() => {
      es.emit("session:updated", makeSessionData({ activity: "idle" }));
    });

    expect(mockPlay).toHaveBeenCalledWith("chime");
  });

  it("does not play sound when toggle is disabled", async () => {
    (window as Record<string, unknown>).piWatch = {
      resizeMini: vi.fn(),
      openSession: vi.fn(),
      getSoundEnabled: () => Promise.resolve(false),
      onSoundToggle: vi.fn(() => () => {}),
    };

    renderHook(() => useActivitySounds());
    const es = MockEventSource.instances[0];

    // Flush the getSoundEnabled promise to set soundEnabled = false
    await act(async () => {});

    act(() => {
      es.emit("session:added", makeSessionData({ activity: "idle" }));
    });

    expect(mockPlay).not.toHaveBeenCalled();
  });

  it("cleans up tracking on session:removed without playing sound", () => {
    renderHook(() => useActivitySounds());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit("session:added", makeSessionData({ activity: "idle" }));
    });
    mockPlay.mockClear();

    act(() => {
      es.emit("session:removed", { sessionId: "s1" });
    });

    expect(mockPlay).not.toHaveBeenCalled();

    // Re-adding same session should produce sound again (tracking was cleared)
    act(() => {
      es.emit("session:added", makeSessionData({ activity: "idle" }));
    });

    expect(mockPlay).toHaveBeenCalledWith("chime");
  });

  it("defaults to enabled when window.piWatch is absent", () => {
    renderHook(() => useActivitySounds());
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit("session:added", makeSessionData({ activity: "idle" }));
    });

    expect(mockPlay).toHaveBeenCalledWith("chime");
  });
});
