import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { Notification } from "electron";

const execFileAsync = promisify(execFileCb);

export interface TmuxTarget {
  session: string;
  window: string;
  pane: string;
}

export type OpenResult = { ok: true } | { ok: false; reason: string };

type Notify = (title: string, body: string) => void;
type ExecFile = (cmd: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

export function buildSwitchArgs(client: string, target: TmuxTarget): string[] {
  return ["switch-client", "-c", client, "-t", `${target.session}:${target.window}.${target.pane}`];
}

export function parseListClients(stdout: string): { count: number; first: string | null } {
  const clients = stdout.split(/\r?\n/).filter((line) => line.trim() !== "");
  return { count: clients.length, first: clients[0] ?? null };
}

export function classify(
  list: { count: number; first: string | null },
  target: TmuxTarget | null,
): "ok" | "not-in-tmux" | "no-client" | "multi-client" {
  if (!target) return "not-in-tmux";
  if (list.count === 0) return "no-client";
  if (list.count > 1) return "multi-client";
  return "ok";
}

function defaultNotify(title: string, body: string): void {
  new Notification({ title, body }).show();
}

function defaultExecFile(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(cmd, args);
}

export function parseTmuxTarget(raw: string): TmuxTarget | null {
  const match = raw.match(/^(.+):(\d+)\.(\d+)$/);
  if (!match) return null;
  return { session: match[1], window: match[2], pane: match[3] };
}

export async function open(
  tmuxTargetStr: string | null,
  deps: { notify?: Notify; exec?: ExecFile } = {},
): Promise<OpenResult> {
  const notify = deps.notify ?? defaultNotify;
  const exec = deps.exec ?? defaultExecFile;

  if (!tmuxTargetStr) {
    notify("pi-watch", "session was not started inside tmux");
    return { ok: false, reason: "not-in-tmux" };
  }

  const target = parseTmuxTarget(tmuxTargetStr);
  if (!target) {
    notify("pi-watch", "invalid tmux target format");
    return { ok: false, reason: "invalid-target" };
  }

  let listOutput: string;
  try {
    const result = await exec("tmux", ["list-clients", "-F", "#{client_name}"]);
    listOutput = result.stdout;
  } catch {
    notify("pi-watch", "tmux server not running");
    return { ok: false, reason: "no-server" };
  }

  const list = parseListClients(listOutput);
  const classification = classify(list, target);

  if (classification === "no-client") {
    notify("pi-watch", "no tmux client attached");
    return { ok: false, reason: "no-client" };
  }

  if (classification === "multi-client") {
    notify("pi-watch", "multiple tmux clients; detach extras and retry");
    return { ok: false, reason: "multi-client" };
  }

  try {
    await exec("tmux", buildSwitchArgs(list.first!, target));
    return { ok: true };
  } catch (error) {
    const msg = (error as { stderr?: string }).stderr ?? String(error);
    notify("pi-watch", `tmux switch failed: ${msg}`);
    return { ok: false, reason: "switch-failed" };
  }
}
