import { fromByteArray } from "../../../lib/base64";
import {
    deserializeArgs,
    serializeArgs
} from "../../../lib/bridge/serialization";

function syncRequest(method: number, ...args: any[]) {
    const request = new XMLHttpRequest();
    const searchParams = new URLSearchParams();
    const payload = new Uint8Array([method, ...serializeArgs(args)]);
    searchParams.set("payload", encodeURIComponent(fromByteArray(payload)));
    request.open("GET", "/call-sync?" + searchParams.toString(), false);
    request.responseType = "arraybuffer";
    request.send();

    return deserializeArgs(new Uint8Array(request.response));
}

// only for WASM
export let cache: Map<string, string> = null;
export function initCache() {
    if (cache) return;
    cache = new Map();
}

const debug = false;

export function staticFile(path: string) {
    if (debug) {
        console.log("staticFile", path);
    }

    if (cache) {
        return cache.get(path);
    }

    const request = new XMLHttpRequest();
    request.open("GET", "/" + path, false);
    request.send();
    return request.responseText;
}

// 2
export function readFile(path: string): string {
    if (debug) {
        console.log("readFile", path);
    }

    if (cache) {
        return cache.get(path);
    }

    return syncRequest(
        2,
        path,
        true // encoding == "utf8"
    ).at(0);
}

// 5
export function readdir(path: string, skip: string[]): string[] {
    if (debug) {
        console.log("readdir", path);
    }

    if (cache) {
        const items = [];
        for (const i of cache.keys()) {
            if (
                i.startsWith(path) &&
                !skip.find((s) => i.startsWith(path + "/" + s))
            ) {
                items.push(i.slice(path.length + 1));
            }
        }
        return items;
    }

    return syncRequest(
        5,
        path,
        true, // recursive
        false, // withFileType
        ...skip
    );
}
