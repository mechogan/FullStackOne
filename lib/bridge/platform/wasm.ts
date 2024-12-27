import { toByteArray } from "base64-js";
import { Bridge } from "..";
import { deserializeArgs } from "../serialization";

export const BridgeWasm: Bridge = async (
    payload: Uint8Array,
    transformer?: (responseArgs: any[]) => any
) => {
    const response = await globalThis.lib.call(payload);
    const args = deserializeArgs(toByteArray(response));

    if (transformer) {
        return transformer(args);
    }

    return args;
};
