import { serializeArgs } from "../serialization";
import { ipc } from ".";
import { FetchOptions, FetchResponse } from "../fullstacked";

const te = new TextEncoder();

// 15
export function fetch(
    url: string,
    options?: Partial<FetchOptions> & { encoding?: "utf8" }
): Promise<
    FetchResponse & {
        body: string | Uint8Array;
    }
> {
    const method = options?.method || "GET";

    const headers = options?.headers ? JSON.stringify(options.headers) : "";

    const body = options?.body
        ? typeof options.body === "string"
            ? te.encode(options.body)
            : options.body
        : new Uint8Array();

    const timeout = options?.timeout || 10;

    const payload = new Uint8Array([
        15,

        ...serializeArgs([
            method,
            url,
            headers,
            body,
            timeout,
            options?.encoding === "utf8"
        ])
    ]);

    const transformer = ([statusCode, statusMessage, headers, body]) => {
        return {
            statusCode,
            statusMessage,
            headers: headers ? JSON.parse(headers) : {},
            body
        };
    };

    return ipc.bridge(payload, transformer);
}
