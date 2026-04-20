import { render, screen } from "@testing-library/react";
import { MockEventSource } from "../test-setup";
import { ActivityLog } from "./ActivityLog";
import { act } from "@testing-library/react";

describe("ActivityLog", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders entries with colored dot", () => {
    render(<ActivityLog />);
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit("session:added", {
        sessionId: "abc12345-long-id",
        activity: "processing",
      });
    });

    const dot = screen.getByText("●");
    expect(dot).toHaveStyle({ color: "rgb(210, 153, 34)" });
    expect(screen.getByText(/abc12345 added/)).toBeInTheDocument();
  });
});
