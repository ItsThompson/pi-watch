import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("piWatch", {
  resizeMini: (height: number) => ipcRenderer.send("pw:resize", height),
  openSession: (id: string) => ipcRenderer.invoke("pw:open-session", id),
  getSoundEnabled: () => ipcRenderer.invoke("pw:get-sound-enabled") as Promise<boolean>,
  onSoundToggle: (cb: (enabled: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, enabled: boolean) => cb(enabled);
    ipcRenderer.on("pw:sound-toggled", handler);
    return () => { ipcRenderer.removeListener("pw:sound-toggled", handler); };
  },
});
