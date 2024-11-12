import ipc from "../../../src";
import { archive } from "./archive";
import { config } from "./config";

export const ipcEditor = {
    ...ipc.methods,
    config,
    archive,
    esbuild: {
        version: () => ipc.bridge(new Uint8Array([14]), ([str]) => str)
    },
};
