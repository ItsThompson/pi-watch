import { Tray, Menu, app } from "electron";
import { resolve } from "node:path";

let tray: Tray | null = null;

export interface TrayMenuToggle {
  onToggle: () => boolean;
  isEnabled: () => boolean;
}

export interface TrayOptions {
  visibility: TrayMenuToggle;
  ghostMode: TrayMenuToggle;
  soundAlerts: TrayMenuToggle;
}

export function createTray(options: TrayOptions): void {
  const iconPath = app.isPackaged
    ? resolve(process.resourcesPath, "assets/tray-iconTemplate.png")
    : resolve(__dirname, "../assets/tray-iconTemplate.png");

  tray = new Tray(iconPath);
  tray.setToolTip("PiWatch");

  const buildMenu = () =>
    Menu.buildFromTemplate([
      {
        label: "Show/Hide",
        type: "checkbox",
        checked: options.visibility.isEnabled(),
        click: (menuItem) => {
          const nowVisible = options.visibility.onToggle();
          menuItem.checked = nowVisible;
        },
      },
      {
        label: "Ghost Mode",
        type: "checkbox",
        checked: options.ghostMode.isEnabled(),
        click: (menuItem) => {
          const nowEnabled = options.ghostMode.onToggle();
          menuItem.checked = nowEnabled;
        },
      },
      {
        label: "Sound Alerts",
        type: "checkbox",
        checked: options.soundAlerts.isEnabled(),
        click: (menuItem) => {
          const nowEnabled = options.soundAlerts.onToggle();
          menuItem.checked = nowEnabled;
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          app.exit();
        },
      },
    ]);

  tray.on("click", () => {
    tray?.popUpContextMenu(buildMenu());
  });
}
