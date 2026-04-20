import { describe, it, expect } from "vitest";
import {
  buildSwitchArgs,
  parseListClients,
  classify,
  type TmuxTarget,
} from "./terminal-opener.js";

describe("buildSwitchArgs", () => {
  it("builds argv for a standard target", () => {
    const target: TmuxTarget = { session: "main", window: "0", pane: "1" };
    expect(buildSwitchArgs("/dev/pts/0", target)).toEqual([
      "switch-client", "-c", "/dev/pts/0", "-t", "main:0.1",
    ]);
  });

  it("handles session names with spaces and dots", () => {
    const target: TmuxTarget = { session: "my.session name", window: "2", pane: "0" };
    expect(buildSwitchArgs("client1", target)).toEqual([
      "switch-client", "-c", "client1", "-t", "my.session name:2.0",
    ]);
  });
});

describe("parseListClients", () => {
  it("parses single client", () => {
    expect(parseListClients("/dev/ttys001\n")).toEqual({
      count: 1,
      first: "/dev/ttys001",
    });
  });

  it("parses multiple clients", () => {
    expect(parseListClients("/dev/ttys001\n/dev/ttys002\n")).toEqual({
      count: 2,
      first: "/dev/ttys001",
    });
  });

  it("handles empty output", () => {
    expect(parseListClients("")).toEqual({ count: 0, first: null });
  });

  it("handles blank lines and CRLF", () => {
    expect(parseListClients("\r\n/dev/ttys001\r\n\r\n")).toEqual({
      count: 1,
      first: "/dev/ttys001",
    });
  });

  it("handles trailing newline only", () => {
    expect(parseListClients("\n")).toEqual({ count: 0, first: null });
  });
});

describe("classify", () => {
  const target: TmuxTarget = { session: "s", window: "0", pane: "0" };

  it("returns not-in-tmux when target is null", () => {
    expect(classify({ count: 1, first: "c" }, null)).toBe("not-in-tmux");
  });

  it("returns no-client when count is 0", () => {
    expect(classify({ count: 0, first: null }, target)).toBe("no-client");
  });

  it("returns multi-client when count > 1", () => {
    expect(classify({ count: 2, first: "c" }, target)).toBe("multi-client");
  });

  it("returns ok when exactly 1 client", () => {
    expect(classify({ count: 1, first: "c" }, target)).toBe("ok");
  });
});
