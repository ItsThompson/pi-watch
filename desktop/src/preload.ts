import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("piWatch", {
  resizeMini: (height: number) => ipcRenderer.send("pw:resize", height),
  openSession: (id: string) => ipcRenderer.invoke("pw:open-session", id),
});
