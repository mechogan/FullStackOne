import ipc from "../../src";
import { config } from "./config";

export const ipcEditor = {
    ...ipc.methods,
    config,
    esbuild: {
        version: () => ipc.bridge(new Uint8Array([12]), ([str]) => str)
    }
}




