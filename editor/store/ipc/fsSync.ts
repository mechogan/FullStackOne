import { deserializeArgs, serializeArgs } from "../../../src/serialization";
import { toBase64 } from "../../api/connectivity/cryptoUtils";

function syncRequest(method: number, ...args: any[]) {
    const request = new XMLHttpRequest();
    const searchParams = new URLSearchParams();
    const payload = new Uint8Array([method, ...serializeArgs(args)]);
    searchParams.set("payload", encodeURIComponent(toBase64(payload)));
    request.open(
        "GET",
        "/call-sync?" + searchParams.toString(),
        false
    );
    request.responseType = "arraybuffer";
    request.send();

    return deserializeArgs(new Uint8Array(request.response));
}

export const fsSync = {
    staticFile: (path: string) => {
        const request = new XMLHttpRequest();
        request.open(
            "GET",
            "/" + path,
            false
        );
        request.send();
        return request.responseText;
    },
    // 2
    readFile: function (path: string): string {
        return syncRequest(
            2, 
            path,
            true // encoding == "utf8"
        ).at(0);
    },
    // 5
    readdir: function (path: string): string[] {
        return syncRequest(
            5, 
            path,
            true, // recursive
            false // withFileType
        );
    }
}