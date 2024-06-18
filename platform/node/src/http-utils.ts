import type { Response } from "./main";
import http from "http";

export function respond(response: Response, res: http.ServerResponse) {
    const headers = {
        "content-type": response.mimeType
    };
    if (response.data) {
        headers["content-length"] = response.data.byteLength.toString();
    }
    res.writeHead(response.status, headers);
    if (response.data) {
        res.write(response.data);
    }
    res.end();
}

export const readBody = (request: http.IncomingMessage) =>
    new Promise<Uint8Array>((resolve) => {
        const contentLengthStr = request.headers["content-length"] || "0";
        const contentLength = parseInt(contentLengthStr);
        if (!contentLength) {
            resolve(new Uint8Array());
            return;
        }

        const body = new Uint8Array(contentLength);
        let i = 0;
        request.on("data", (chunk: Buffer) => {
            for (let j = 0; j < chunk.byteLength; j++) {
                body[j + i] = chunk[j];
            }
            i += chunk.length;
        });
        request.on("end", () => resolve(body));
    });
