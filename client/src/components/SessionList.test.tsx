import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import type { RegisteredSession } from "@pi-watch/shared";
import { MockEventSource } from "../test-setup";
import { SessionList } from "./SessionList";

function makeSession(
  overrides: Partial<RegisteredSession> = {},
): RegisteredSession {
  return {
    sessionId: "s1",
    pid: 1,
    cwd: "/home/user/my-project",
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

describe("SessionList", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    MockEventSource.instances = [];
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders empty state when no sessions exist", async () => {
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve([]),
      ok: true,
    });

    render(<SessionList />, { wrapper });

    expect(
      await screen.findByText("No open sessions"),
    ).toBeInTheDocument();
  });

  it("renders activity dot with correct color class", async () => {
    const session = makeSession({ activity: "pending_approval" });
    fetchMock.mockResolvedValue({
      json: () => Promise.resolve([session]),
      ok: true,
    });

    render(<SessionList />, { wrapper });

    const dot = await screen.findByText("●");
    expect(dot).toHaveClass("text-activity-pending");
  });

  it("clicking a row calls fetch with the session id", async () => {
    const session = makeSession({ sessionId: "click-me" });
    fetchMock
      .mockResolvedValueOnce({
        json: () => Promise.resolve([session]),
        ok: true,
      })
      .mockResolvedValue({ ok: true });

    render(<SessionList />, { wrapper });

    const button = await screen.findByRole("button", { name: /my-project/ });
    await userEvent.click(button);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/open-terminal",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sessionId: "click-me" }),
      }),
    );
  });
});
