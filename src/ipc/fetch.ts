import {
    deserializeArgs,
    getLowestKeyIdAvailable,
    serializeArgs
} from "../serialization";
import { ipc } from ".";
import { FetchOptions, FetchResponse } from "../fullstacked";
import { fromBase64 } from "../../editor/api/connectivity/cryptoUtils";

const te = new TextEncoder();

type Response = {
    statusCode: number;
    statusMessage: string;
    headers: Record<string, string>;
    body: string | Uint8Array;
};

const activeFetchRequest = new Map<number, (response: Response) => void>();
let addedListener = false;
function receivedResponse(base64Data: string) {
    const data = fromBase64(base64Data);
    const [id, statusCode, statusMessage, headersStr, body] =
        deserializeArgs(data);
    const fetchRequest = activeFetchRequest.get(id);
    fetchRequest({
        statusCode,
        statusMessage,
        headers: headersStr ? JSON.parse(headersStr) : {},
        body
    });
    activeFetchRequest.delete(id);
}

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

    const requestId = getLowestKeyIdAvailable(activeFetchRequest);

    const payload = new Uint8Array([
        15,

        ...serializeArgs([
            requestId,
            method,
            url,
            headers,
            body,
            timeout,
            options?.encoding === "utf8"
        ])
    ]);

    if (!addedListener) {
        addCoreMessageListener("fetch-response", receivedResponse);
        addedListener = true;
    }

    return new Promise<Response>((resolve) => {
        activeFetchRequest.set(requestId, resolve);
        ipc.bridge(payload);
    });
}
