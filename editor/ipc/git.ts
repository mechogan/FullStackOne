import { serializeArgs } from "../../src/serialization"
import ipc from "../../src";

export const git = {
    clone
}

// 70
function clone(url: string){
    const payload = new Uint8Array([
        70,
        ...serializeArgs([url])
    ])

    return ipc.bridge(payload);
}