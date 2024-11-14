import { ipcEditor } from ".";
import ipc from "../../src";
import { serializeArgs } from "../../src/serialization";

// 100
export function open(projectId: string) {
    const payload = new Uint8Array([100, ...serializeArgs([projectId])]);

    return ipc.bridge(payload);
}
