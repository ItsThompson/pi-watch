import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { MockEventSource } from "./test-setup";
import { App } from "./App";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );
}

describe("App", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([]),
      ok: true,
    });
    delete window.piWatch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders without throwing when window.piWatch is undefined", async () => {
    render(<App />, { wrapper });
    expect(
      await screen.findByText("No open sessions"),
    ).toBeInTheDocument();
  });
});
