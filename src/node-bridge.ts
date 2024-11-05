import type {ipc} from "./ipc";
import { deserializeArgs } from "./serialization";

export const NodeBridge: typeof ipc.bridge = async (payload: Uint8Array, transformer?: (responseArgs: any[]) => any) => {
    const response = await fetch("/call", {
        method: "POST",
        body: payload
    })
    const data = new Uint8Array(await response.arrayBuffer());
    const args = deserializeArgs(data);

    if(transformer) {
        return transformer(args);
    }

    return args;
}