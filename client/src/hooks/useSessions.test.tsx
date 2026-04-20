import { renderHook, act, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import type { RegisteredSession } from "@pi-watch/shared";
import { MockEventSource } from "../test-setup";
import { useSessions } from "./useSessions";

function makeSession(overrides: Partial<RegisteredSession> = {}): RegisteredSession {
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

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

describe("useSessions", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    MockEventSource.instances = [];
    fetchMock = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([]),
      ok: true,
    });
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("given SSE emits session:added, then sessions contains the new session", async () => {
    const session = makeSession({ sessionId: "new-1" });
    const { result } = renderHook(() => useSessions(), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    act(() => {
      MockEventSource.instances[0].emit("session:added", session);
    });

    await waitFor(() => {
      expect(result.current.sessions).toEqual([session]);
    });
  });

  it("given sessions A and B, when session:removed arrives for A, then only B remains", async () => {
    const sessionA = makeSession({ sessionId: "a" });
    const sessionB = makeSession({ sessionId: "b" });
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve([sessionA, sessionB]),
      ok: true,
    });

    const { result } = renderHook(() => useSessions(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(2);
    });

    act(() => {
      MockEventSource.instances[0].emit("session:removed", {
        sessionId: "a",
      });
    });

    await waitFor(() => {
      expect(result.current.sessions).toEqual([sessionB]);
    });
  });

  it("given SSE reconnects, when snapshot resolves, then list matches snapshot", async () => {
    const { result } = renderHook(() => useSessions(), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const freshSession = makeSession({ sessionId: "fresh" });
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve([freshSession]),
      ok: true,
    });

    act(() => {
      MockEventSource.instances[0].emitOpen();
    });

    await waitFor(() => {
      expect(result.current.sessions).toEqual([freshSession]);
    });
  });
});
