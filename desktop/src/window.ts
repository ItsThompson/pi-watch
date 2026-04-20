import { BrowserWindow, ipcMain } from "electron";
import { resolve } from "node:path";
import type { PiWatchConfig } from "@pi-watch/shared";

let win: BrowserWindow | null = null;
let visible = false;
let ghostEnabled = false;
let ghostOpacityValue = 1;

const WIDTH = 300;
const MIN_HEIGHT = 60;

export function applyVisualState(state: {
  visible: boolean;
  ghostEnabled: boolean;
  ghostOpacity: number;
}): { opacity: number; ignoreMouse: boolean } {
  if (!state.visible) return { opacity: 0, ignoreMouse: true };
  if (state.ghostEnabled) return { opacity: state.ghostOpacity, ignoreMouse: true };
  return { opacity: 1, ignoreMouse: false };
}

function syncVisualState(): void {
  if (!win) return;
  const { opacity, ignoreMouse } = applyVisualState({
    visible,
    ghostEnabled,
    ghostOpacity: ghostOpacityValue,
  });
  win.setOpacity(opacity);
  win.setIgnoreMouseEvents(ignoreMouse);
}

export function createWindow(url: string, config: PiWatchConfig): void {
  win = new BrowserWindow({
    title: "PiWatch",
    width: WIDTH,
    height: MIN_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    type: "panel",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: resolve(__dirname, "preload.cjs"),
    },
  });

  if (config.ghostMode) {
    ghostEnabled = true;
    ghostOpacityValue = config.ghostOpacity;
  }

  win.loadURL(url);

  win.once("ready-to-show", () => {
    win?.showInactive();
    syncVisualState();
  });

  ipcMain.on("pw:resize", (_event, height: number) => {
    if (!win) return;
    const clamped = Math.min(600, Math.max(MIN_HEIGHT, Math.round(height)));
    const [x, y] = win.getPosition();
    win.setBounds({ x, y, width: WIDTH, height: clamped });
  });

  win.on("close", (event) => {
    event.preventDefault();
    visible = false;
    syncVisualState();
  });
}

export function setGhostMode(enabled: boolean, opacity: number): void {
  ghostEnabled = enabled;
  ghostOpacityValue = opacity;
  syncVisualState();
}

export function toggleWindow(): boolean {
  if (!win) return false;
  visible = !visible;
  syncVisualState();
  return visible;
}

export function isWindowVisible(): boolean {
  return visible;
}

export function showWindow(): void {
  visible = true;
  syncVisualState();
}

export function _getTestState() {
  return { visible, ghostEnabled, ghostOpacityValue };
}
