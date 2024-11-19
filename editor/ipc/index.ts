import ipc from "../../src";
import { archive } from "./archive";
import { config } from "./config";
import { esbuild } from "./esbuild";
import { packages } from "./packages";
import { open } from "./open";
import { git } from "./git";

export const ipcEditor = {
    ...ipc.methods,
    config,
    archive,
    esbuild,
    packages,
    git,
    open
};
