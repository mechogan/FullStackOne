import { contextBridge, ipcRenderer } from "electron/renderer";

contextBridge.exposeInMainWorld("electronAPI", {
    bridge: (payload: Uint8Array) => ipcRenderer.invoke("bridge", payload)
});
