import { toByteArray } from "../base64";
import { bridge } from "../bridge";
import { deserializeArgs, getLowestKeyIdAvailable, serializeArgs } from "../bridge/serialization";
import core_message from "../core_message";

const te = new TextEncoder()

type Response = {
    statusCode: number;
    statusMessage: string;
    headers: Record<string, string>;
    body: string | Uint8Array;
};

const activeFetchRequest = new Map<
    number,
    {
        resolve: (response: Response) => void;
        reject: (error: string) => void;
    }
>();
let addedListener = false;
function receivedResponse(base64Data: string) {
    const data = toByteArray(base64Data);
    const [id, statusCode, statusMessage, headersStr, body] =
        deserializeArgs(data);
    const fetchRequest = activeFetchRequest.get(id);

    if (statusCode >= 400) {
        fetchRequest.reject(body);
    } else {
        fetchRequest.resolve({
            statusCode,
            statusMessage,
            headers: headersStr ? JSON.parse(headersStr) : {},
            body
        });
    }

    activeFetchRequest.delete(id);
}

// 15
export default function core_fetch(
    url: string,
    options?: Partial<FetchOptions>
): Promise<FetchResponse & { body: Uint8Array }>;
export default function core_fetch(
    url: string,
    options?: Partial<FetchOptions> & { encoding: "utf8" }
): Promise<FetchResponse & { body: string }>;
export default function core_fetch(
    url: string,
    options?: Partial<FetchOptions> & { encoding?: "utf8" }
) {
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
        core_message.addListener("fetch-response", receivedResponse);
        addedListener = true;
    }

    return new Promise<Response>((resolve, reject) => {
        activeFetchRequest.set(requestId, {
            resolve,
            reject
        });
        bridge(payload);
    });
}
