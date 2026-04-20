import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// Mock node:http and node:child_process before importing
const mockRequest = vi.fn();
vi.mock("node:http", () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

vi.mock("node:child_process", () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: (err: Error | null, stdout: string) => void) => {
    cb(null, "main:1.2\n");
  }),
}));

function stubHttp() {
  mockRequest.mockImplementation((_opts: unknown, cb: (res: { statusCode: number; resume: () => void }) => void) => {
    process.nextTick(() => cb({ statusCode: 200, resume: vi.fn() }));
    return { on: vi.fn(), end: vi.fn(), destroy: vi.fn() };
  });
}

interface FakePi {
  on: ReturnType<typeof vi.fn>;
  events: EventEmitter;
  getSessionName: ReturnType<typeof vi.fn>;
}

function createFakePi(): FakePi {
  return {
    on: vi.fn(),
    events: new EventEmitter(),
    getSessionName: vi.fn().mockReturnValue(null),
  };
}

function getHandler(pi: FakePi, event: string): (...args: unknown[]) => Promise<void> {
  const call = pi.on.mock.calls.find((c: unknown[]) => c[0] === event);
  if (!call) throw new Error(`No handler for ${event}`);
  return call[1] as (...args: unknown[]) => Promise<void>;
}

describe("extension entry wiring", () => {
  let pi: FakePi;

  beforeEach(() => {
    mockRequest.mockReset();
    stubHttp();
    pi = createFakePi();
  });

  it("registers handlers for all lifecycle events", async () => {
    const { default: setup } = await import("./index.js");
    setup(pi as unknown as import("@mariozechner/pi-coding-agent").ExtensionAPI);

    const registeredEvents = pi.on.mock.calls.map((c: unknown[]) => c[0]);
    expect(registeredEvents).toContain("session_start");
    expect(registeredEvents).toContain("agent_start");
    expect(registeredEvents).toContain("tool_execution_start");
    expect(registeredEvents).toContain("tool_execution_end");
    expect(registeredEvents).toContain("agent_end");
    expect(registeredEvents).toContain("session_shutdown");
  });

  it("registers on session_start and posts to server", async () => {
    const { default: setup } = await import("./index.js");
    setup(pi as unknown as import("@mariozechner/pi-coding-agent").ExtensionAPI);

    const handler = getHandler(pi, "session_start");
    await handler({}, {
      cwd: "/test",
      sessionManager: { getSessionId: () => "test-session" },
    });

    // Should have called register
    expect(mockRequest).toHaveBeenCalled();
    const opts = mockRequest.mock.calls[0][0];
    expect(opts.path).toBe("/api/sessions/register");
  });

  it("calls unregister on session_shutdown", async () => {
    const { default: setup } = await import("./index.js");
    setup(pi as unknown as import("@mariozechner/pi-coding-agent").ExtensionAPI);

    // First start a session
    const startHandler = getHandler(pi, "session_start");
    await startHandler({}, {
      cwd: "/test",
      sessionManager: { getSessionId: () => "test-session" },
    });

    mockRequest.mockClear();
    stubHttp();

    const shutdownHandler = getHandler(pi, "session_shutdown");
    await shutdownHandler({}, {});

    expect(mockRequest).toHaveBeenCalled();
    const opts = mockRequest.mock.calls[0][0];
    expect(opts.path).toBe("/api/sessions/unregister");
  });

  it("handles permission events from pi.events bus", async () => {
    const { default: setup } = await import("./index.js");
    setup(pi as unknown as import("@mariozechner/pi-coding-agent").ExtensionAPI);

    mockRequest.mockClear();
    stubHttp();

    pi.events.emit("pi-watch:permission-prompt-start", { sessionId: "s1" });

    // Wait for async
    await new Promise((r) => setTimeout(r, 10));

    const paths = mockRequest.mock.calls.map((c: unknown[]) => (c[0] as { path: string }).path);
    expect(paths).toContain("/api/sessions/s1/permission-prompt-start");
  });

  it("heartbeat snapshot re-captures tmux target", async () => {
    vi.useFakeTimers();

    const { execFile } = await import("node:child_process");
    const mockExecFile = vi.mocked(execFile);

    const { default: setup } = await import("./index.js");
    setup(pi as unknown as import("@mariozechner/pi-coding-agent").ExtensionAPI);

    const startHandler = getHandler(pi, "session_start");
    await startHandler({}, {
      cwd: "/test",
      sessionManager: { getSessionId: () => "test-session" },
    });

    const callCountAfterStart = mockExecFile.mock.calls.length;

    // Advance timer to trigger heartbeat (which should re-call captureTmuxTarget)
    await vi.advanceTimersByTimeAsync(5000);

    vi.useRealTimers();

    // execFile should have been called again for the heartbeat snapshot
    expect(mockExecFile.mock.calls.length).toBeGreaterThan(callCountAfterStart);
  });

  it("does not throw when handlers encounter errors", async () => {
    const { default: setup } = await import("./index.js");
    setup(pi as unknown as import("@mariozechner/pi-coding-agent").ExtensionAPI);

    // agent_start with no session should not throw
    const agentStartHandler = getHandler(pi, "agent_start");
    await expect(agentStartHandler({}, {})).resolves.toBeUndefined();
  });
});
