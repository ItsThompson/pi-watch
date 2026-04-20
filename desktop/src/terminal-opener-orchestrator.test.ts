import { describe, it, expect } from "vitest";
import { open } from "./terminal-opener.js";

function createFakes() {
  const notifications: Array<{ title: string; body: string }> = [];
  const execCalls: Array<{ cmd: string; args: string[] }> = [];
  let execResults: Array<{ stdout: string; stderr: string } | Error> = [];

  const notify = (title: string, body: string) => {
    notifications.push({ title, body });
  };

  const exec = async (cmd: string, args: string[]) => {
    execCalls.push({ cmd, args });
    const result = execResults.shift();
    if (result instanceof Error) {throw result;}
    return result ?? { stdout: "", stderr: "" };
  };

  return {
    notifications,
    execCalls,
    setExecResults: (results: Array<{ stdout: string; stderr: string } | Error>) => {
      execResults = [...results];
    },
    deps: { notify, exec },
  };
}

describe("open orchestrator", () => {
  it("notifies when target is null", async () => {
    const { deps, notifications } = createFakes();
    const result = await open(null, deps);
    expect(result).toEqual({ ok: false, reason: "not-in-tmux" });
    expect(notifications[0]?.body).toBe("session was not started inside tmux");
  });

  it("notifies when tmux server is not running", async () => {
    const { deps, notifications, setExecResults } = createFakes();
    setExecResults([new Error("no server")]);
    const result = await open("main:0.1", deps);
    expect(result).toEqual({ ok: false, reason: "no-server" });
    expect(notifications[0]?.body).toBe("tmux server not running");
  });

  it("notifies when no clients attached", async () => {
    const { deps, notifications, setExecResults } = createFakes();
    setExecResults([{ stdout: "", stderr: "" }]);
    const result = await open("main:0.1", deps);
    expect(result).toEqual({ ok: false, reason: "no-client" });
    expect(notifications[0]?.body).toBe("no tmux client attached");
  });

  it("notifies when multiple clients attached", async () => {
    const { deps, notifications, setExecResults } = createFakes();
    setExecResults([{ stdout: "/dev/ttys001\n/dev/ttys002\n", stderr: "" }]);
    const result = await open("main:0.1", deps);
    expect(result).toEqual({ ok: false, reason: "multi-client" });
    expect(notifications[0]?.body).toContain("multiple tmux clients");
  });

  it("switches client when exactly one client", async () => {
    const { deps, execCalls, setExecResults } = createFakes();
    setExecResults([
      { stdout: "/dev/ttys001\n", stderr: "" },
      { stdout: "", stderr: "" },
    ]);
    const result = await open("main:0.1", deps);
    expect(result).toEqual({ ok: true });
    expect(execCalls[1]).toEqual({
      cmd: "tmux",
      args: ["switch-client", "-c", "/dev/ttys001", "-t", "main:0.1"],
    });
  });

  it("notifies on switch-client failure", async () => {
    const { deps, notifications, setExecResults } = createFakes();
    const err = new Error("fail") as Error & { stderr: string };
    err.stderr = "can't find pane";
    setExecResults([
      { stdout: "/dev/ttys001\n", stderr: "" },
      err,
    ]);
    const result = await open("main:0.1", deps);
    expect(result).toEqual({ ok: false, reason: "switch-failed" });
    expect(notifications[0]?.body).toContain("can't find pane");
  });
});
