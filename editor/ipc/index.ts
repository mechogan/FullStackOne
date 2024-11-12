import ipc from "../../src";
import { archive } from "./archive";
import { config } from "./config";
import { esbuild } from "./esbuild";

export const ipcEditor = {
    ...ipc.methods,
    config,
    archive,
    esbuild
};
