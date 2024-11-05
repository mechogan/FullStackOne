import { ipc } from "../src/ipc";

export type ipcEditor = ipc & {
    esbuild: {
        version: () => {}
        build: () => {}
    },
    run: () => {},
    open: () => void
}