import type { ipc } from "../ipc";
import { deserializeArgs } from "../serialization";

// SYNC
export const BridgeWasm: typeof ipc.bridge = (
    payload: Uint8Array,
    transformer?: (responseArgs: any[]) => any
) => {
    const response = globalThis.lib.call(payload);
    const args = deserializeArgs(response);

    if (transformer) {
        return transformer(args);
    }

    return args;
};
