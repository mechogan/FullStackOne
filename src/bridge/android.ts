import { fromByteArray, toByteArray } from "base64-js";
import type { ipc } from "../ipc";
import { deserializeArgs } from "../serialization";

export const BridgeAndroid: typeof ipc.bridge = async (
    payload: Uint8Array,
    transformer?: (responseArgs: any[]) => any
) => {
    const base64 = fromByteArray(payload);
    const response = toByteArray(globalThis.android.bridge(base64));
    const args = deserializeArgs(response);

    if (transformer) {
        return transformer(args);
    }

    return args;
};
