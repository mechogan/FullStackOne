import type { ipc } from "../ipc";
import { deserializeArgs } from "../serialization";

// ASYNC
export const BridgeNode: typeof ipc.bridge = async (
    payload: Uint8Array,
    transformer?: (responseArgs: any[]) => any
) => {
    const response = await fetch("/call", {
        method: "POST",
        body: payload
    });
    const data = new Uint8Array(await response.arrayBuffer());
    const args = deserializeArgs(data);

    if (transformer) {
        return transformer(args);
    }

    return args;
};

export function initCallbackNode() {
    const url = new URL(globalThis.location.href);
    url.protocol = "ws:";
    const ws = new WebSocket(url.toString());
    ws.onmessage = (e) => {
        const [type, message] = JSON.parse(e.data);
        (globalThis as any).onmessage(type, message)
    };
}
