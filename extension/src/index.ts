import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { ActivityTracker } from "./activity-tracker.js";
import { HeartbeatClient } from "./heartbeat-client.js";
import { captureTmuxTarget, type Exec } from "./tmux-target.js";
import { execFile } from "node:child_process";

const exec: Exec = (cmd, args) =>
  new Promise((resolve) => {
    execFile(cmd, args, { timeout: 5000 }, (error, stdout) => {
      resolve({ stdout: stdout ?? "", code: error ? 1 : 0 });
    });
  });

export default function (pi: ExtensionAPI) {
  const tracker = new ActivityTracker();
  const client = new HeartbeatClient();
  let sessionId: string | undefined;
  let lastKnownTmuxTarget: string | null = null;

  pi.on("session_start", async (_event, ctx) => {
    try {
      sessionId = ctx.sessionManager.getSessionId();
      const cwd = ctx.cwd;
      const tmux = await captureTmuxTarget(process.env, exec);
      lastKnownTmuxTarget = tmux?.target ?? null;

      await client.register({
        sessionId,
        pid: process.pid,
        cwd,
        tmuxTarget: lastKnownTmuxTarget,
        startTime: new Date().toISOString(),
        agentName: pi.getSessionName() ?? undefined,
      });

      client.startHeartbeats(async () => {
        const freshTmux = await captureTmuxTarget(process.env, exec);
        if (freshTmux) {lastKnownTmuxTarget = freshTmux.target;}
        return {
          sessionId: sessionId!,
          tmuxTarget: freshTmux?.target ?? lastKnownTmuxTarget,
          agentName: pi.getSessionName() ?? undefined,
          ...tracker.snapshot(),
        };
      });
    } catch (err) {
      console.error("[pi-watch] session_start error:", err);
    }
  });

  pi.on("agent_start", async () => {
    try { tracker.onAgentStart(); } catch (err) { console.error("[pi-watch] agent_start error:", err); }
  });

  pi.on("tool_execution_start", async () => {
    try { tracker.onToolStart(); } catch (err) { console.error("[pi-watch] tool_execution_start error:", err); }
  });

  pi.on("tool_execution_end", async () => {
    try { tracker.onToolEnd(); } catch (err) { console.error("[pi-watch] tool_execution_end error:", err); }
  });

  pi.on("agent_end", async () => {
    try { tracker.onAgentEnd(); } catch (err) { console.error("[pi-watch] agent_end error:", err); }
  });

  pi.events.on("pi-watch:permission-prompt-start", (data: unknown) => {
    try {
      const { sessionId: sid } = data as { sessionId: string };
      tracker.onPermissionStart();
      client.postPermissionStart(sid);
    } catch (err) {
      console.error("[pi-watch] permission-prompt-start error:", err);
    }
  });

  pi.events.on("pi-watch:permission-prompt-end", (data: unknown) => {
    try {
      const { sessionId: sid } = data as { sessionId: string };
      tracker.onPermissionEnd();
      client.postPermissionEnd(sid);
    } catch (err) {
      console.error("[pi-watch] permission-prompt-end error:", err);
    }
  });

  pi.on("session_shutdown", async () => {
    try {
      client.stopHeartbeats();
      if (sessionId) {await client.unregister(sessionId);}
    } catch (err) {
      console.error("[pi-watch] session_shutdown error:", err);
    }
  });
}
