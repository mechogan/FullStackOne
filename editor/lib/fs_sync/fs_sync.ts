import { fromByteArray } from "../../../lib/base64";
import { deserializeArgs, serializeArgs } from "../../../lib/bridge/serialization";

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

export function staticFile(path: string) {
    const request = new XMLHttpRequest();
    request.open("GET", "/" + path, false);
    request.send();
    return request.responseText;
}

// 2
export function readFile(path: string): string {
    return syncRequest(
        2,
        path,
        true // encoding == "utf8"
    ).at(0);
}

// 5
export function readdir(path: string, skip: string[]): string[] {
    return syncRequest(
        5,
        path,
        true, // recursive
        false, // withFileType
        ...skip
    );
}
