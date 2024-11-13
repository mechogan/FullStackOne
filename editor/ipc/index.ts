import ipc from "../../src";
import { archive } from "./archive";
import { config } from "./config";
import { esbuild } from "./esbuild";
import { packages } from "./packages";
import { open } from "./open";

export const ipcEditor = {
    ...ipc.methods,
    config,
    archive,
    esbuild,
    packages,
    open
};
