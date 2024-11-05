import { ipc } from "../src/ipc";

export const ipcEditor = {
    ...ipc,
    methods: {
        ...ipc.methods,
        directories: {
            config: () => simpleGetString(),
            nodeModules: () => simpleGetString()
        },
        esbuild: {
            version: () => simpleGetString(12)
        }
    }
}

function simpleGetString(method: number) {
    return ipc.bridge(new Uint8Array([method]), ([str]) => str)
}