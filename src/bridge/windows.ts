import { fromByteArray, toByteArray } from "base64-js";
import type { ipc } from "../ipc";
import {
    bytesToNumber,
    deserializeArgs,
    numberTo4Bytes
} from "../serialization";

const requests = new Map<number, (data: Uint8Array) => void>();

// ASYNC
export const BridgeWindows: typeof ipc.bridge = (
    payload: Uint8Array,
    transformer?: (responseArgs: any[]) => any
) => {
    const currentIds = Array.from(requests.keys()).sort();
    let requestId = 0;
    for (const id of currentIds) {
        if (requestId !== id) break;
        requestId++;
    }

    const base64 = fromByteArray(
        new Uint8Array([...numberTo4Bytes(requestId), ...payload])
    );

    return new Promise((resolve) => {
        requests.set(requestId, (data) => {
            const args = deserializeArgs(data);

            if (transformer) {
                return resolve(transformer(args));
            }

            resolve(args);
        });

        globalThis.chrome.webview.postMessage(base64);
    });
};

globalThis.respond = (base64: string) => {
    const data = toByteArray(base64);
    const id = bytesToNumber(data.slice(0, 4));
    const resolver = requests.get(id);
    resolver(data.slice(4));
    requests.delete(id);
};
