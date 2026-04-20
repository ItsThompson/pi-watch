import { app, globalShortcut, ipcMain, Notification } from "electron";
import http from "node:http";
import { getConfigPath, DEFAULT_CONFIG, type PiWatchConfig } from "@pi-watch/shared";
import * as server from "./server.js";
import {
  createWindow,
  toggleWindow,
  showWindow,
  setGhostMode,
  isWindowVisible,
  _getTestState,
} from "./window.js";
import { createTray } from "./tray.js";
import { loadConfig, saveConfig } from "./config.js";
import { open as openTerminal, parseTmuxTarget } from "./terminal-opener.js";
import { log } from "./utils/logger.js";

let currentConfig: PiWatchConfig = { ...DEFAULT_CONFIG };
const configPath = getConfigPath();

app.on("ready", async () => {
  log({
    timestamp: new Date().toISOString(),
    event: "app_started",
    version: app.getVersion(),
    packaged: app.isPackaged,
  });

  if (app.dock) {
    app.dock.hide();
  }

  server.killPortOccupant();
  server.start();

  try {
    await server.waitForReady();
  } catch {
    log({ timestamp: new Date().toISOString(), event: "server_connect_failed" });
    app.exit(1);
    return;
  }

  currentConfig = loadConfig(configPath);
  createWindow(server.SERVER_URL, currentConfig);

  createTray(
    toggleWindow,
    isWindowVisible,
    () => {
      currentConfig.ghostMode = !currentConfig.ghostMode;
      setGhostMode(currentConfig.ghostMode, currentConfig.ghostOpacity);
      saveConfig(configPath, currentConfig);
      return currentConfig.ghostMode;
    },
    () => currentConfig.ghostMode,
  );

  const registered = globalShortcut.register("F5", toggleWindow);
  if (!registered) {
    log({
      timestamp: new Date().toISOString(),
      event: "f5_register_failed",
      reason: "already_bound",
    });
    new Notification({
      title: "pi-watch",
      body: "F5 is already bound by another app. Use the tray menu.",
    }).show();
  }

  showWindow();

  ipcMain.handle("pw:open-session", async (_event, sessionId: string) => {
    try {
      const body = JSON.stringify({ sessionId });
      const response = await new Promise<string>((resolve, reject) => {
        const req = http.request(`${server.SERVER_URL}/api/open-terminal`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        }, (res) => {
          let data = "";
          res.on("data", (chunk: string) => { data += chunk; });
          res.on("end", () => resolve(data));
        });
        req.on("error", reject);
        req.end(body);
      });

      const parsed = JSON.parse(response);
      if (parsed.error) {
        new Notification({ title: "pi-watch", body: parsed.error }).show();
        return { ok: false, reason: parsed.error };
      }

      return openTerminal(parsed.tmuxTarget);
    } catch (error) {
      log({
        timestamp: new Date().toISOString(),
        event: "open_session_error",
        error: String(error),
      });
      return { ok: false, reason: "internal-error" };
    }
  });

  if (process.env.PI_WATCH_TEST) {
    (global as Record<string, unknown>).__piWatchTest = {
      toggleWindow,
      showWindow,
      setGhostMode,
      isWindowVisible,
      getState: _getTestState,
      toggleGhost: () => {
        currentConfig.ghostMode = !currentConfig.ghostMode;
        setGhostMode(currentConfig.ghostMode, currentConfig.ghostOpacity);
        return currentConfig.ghostMode;
      },
    };
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  server.stop();
});

app.on("window-all-closed", () => {
  // No-op: keep app alive via tray
});
