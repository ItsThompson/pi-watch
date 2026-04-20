import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  HEARTBEAT_INTERVAL_MS,
  BACKOFF_INTERVAL_MS,
} from "@pi-watch/shared";

// We need to mock node:http before importing HeartbeatClient
const mockRequest = vi.fn();
vi.mock("node:http", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

const { HeartbeatClient } = await import("./heartbeat-client.js");

function stubHttp(statusCode: number) {
  mockRequest.mockImplementation((_opts: unknown, cb: (res: { statusCode: number; resume: () => void }) => void) => {
    const res = { statusCode, resume: vi.fn() };
    // Call callback async to simulate real behavior
    process.nextTick(() => cb(res));
    return {
      on: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
    };
  });
}

function stubHttpError() {
  mockRequest.mockImplementation((_opts: unknown, _cb: unknown) => {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    const req = {
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        handlers[event] = handler;
      }),
      end: vi.fn(() => {
        process.nextTick(() => handlers["error"]?.(new Error("ECONNREFUSED")));
      }),
      destroy: vi.fn(),
    };
    return req;
  });
}

describe("HeartbeatClient", () => {
  let client: InstanceType<typeof HeartbeatClient>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRequest.mockReset();
    client = new HeartbeatClient();
  });

  afterEach(() => {
    client.stopHeartbeats();
    vi.useRealTimers();
  });

  it("register posts to /api/sessions/register", async () => {
    stubHttp(200);
    await client.register({
      sessionId: "s1",
      pid: 123,
      cwd: "/tmp",
      tmuxTarget: null,
      startTime: "2026-01-01T00:00:00.000Z",
    });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    const opts = mockRequest.mock.calls[0][0];
    expect(opts.path).toBe("/api/sessions/register");
    expect(opts.method).toBe("POST");
  });

  it("schedules heartbeats at HEARTBEAT_INTERVAL_MS", async () => {
    stubHttp(200);
    const snapshot = vi.fn().mockResolvedValue({
      sessionId: "s1",
      activity: "idle",
      lastEventTime: "2026-01-01T00:00:00.000Z",
      tmuxTarget: null,
    });

    client.startHeartbeats(snapshot);
    expect(snapshot).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });

  it("backs off after 3 consecutive failures", async () => {
    stubHttpError();
    const snapshot = vi.fn().mockResolvedValue({
      sessionId: "s1",
      activity: "idle",
      lastEventTime: "2026-01-01T00:00:00.000Z",
      tmuxTarget: null,
    });

    client.startHeartbeats(snapshot);

    // 3 failures at normal cadence
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(snapshot).toHaveBeenCalledTimes(3);

    // Next one should be at backoff interval
    snapshot.mockClear();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(snapshot).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(BACKOFF_INTERVAL_MS - HEARTBEAT_INTERVAL_MS);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });

  it("resets cadence on success after backoff", async () => {
    stubHttpError();
    const snapshot = vi.fn().mockResolvedValue({
      sessionId: "s1",
      activity: "idle",
      lastEventTime: "2026-01-01T00:00:00.000Z",
      tmuxTarget: null,
    });

    client.startHeartbeats(snapshot);

    // 3 failures
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
    expect(snapshot).toHaveBeenCalledTimes(3);

    // Now succeed
    stubHttp(200);
    await vi.advanceTimersByTimeAsync(BACKOFF_INTERVAL_MS);
    snapshot.mockClear();

    // Should be back to normal cadence
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(snapshot).toHaveBeenCalledTimes(1);
  });

  it("stopHeartbeats prevents further heartbeats", async () => {
    stubHttp(200);
    const snapshot = vi.fn().mockResolvedValue({
      sessionId: "s1",
      activity: "idle",
      lastEventTime: "2026-01-01T00:00:00.000Z",
      tmuxTarget: null,
    });

    client.startHeartbeats(snapshot);
    client.stopHeartbeats();

    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
    expect(snapshot).not.toHaveBeenCalled();
  });

  it("unregister resolves even on server error", async () => {
    stubHttp(500);
    await expect(client.unregister("s1")).resolves.toBeUndefined();
  });

  it("postPermissionStart posts to correct url", async () => {
    stubHttp(200);
    await client.postPermissionStart("s1");

    const opts = mockRequest.mock.calls[0][0];
    expect(opts.path).toBe("/api/sessions/s1/permission-prompt-start");
  });

  it("postPermissionEnd posts to correct url", async () => {
    stubHttp(200);
    await client.postPermissionEnd("s1");

    const opts = mockRequest.mock.calls[0][0];
    expect(opts.path).toBe("/api/sessions/s1/permission-prompt-end");
  });

  it("swallows network errors on all methods", async () => {
    stubHttpError();
    await expect(client.register({ sessionId: "s1", pid: 1, cwd: "/", tmuxTarget: null, startTime: "" })).resolves.toBeUndefined();
    await expect(client.unregister("s1")).resolves.toBeUndefined();
    await expect(client.postPermissionStart("s1")).resolves.toBeUndefined();
    await expect(client.postPermissionEnd("s1")).resolves.toBeUndefined();
  });
});
