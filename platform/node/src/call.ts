import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const core = require('./core.node');

export function load(libPath: string) {
    core.load(libPath);
}

export function setDirectories(directories: {
    root: string;
    config: string;
    editor: string;
}) {
    core.directories(
        directories.root,
        directories.config,
        directories.editor
    )
}

export function setCallback(
    cb: (projectId: string, messageType: string, message: string) => void
) {
    core.callback((id: number) => {
        core.callbackValue(id, cb)
    })
}

export function callLib(payload: Uint8Array): Uint8Array {
    return core.call(payload)
}
