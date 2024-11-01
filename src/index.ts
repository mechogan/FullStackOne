import { SourceMapConsumer } from "source-map-js";
import { Platform } from "./platforms";
import type { AwaitAll, AwaitNone } from "../editor/rpc";
import { bindPassRequestBody } from "./android";
import { serializeArgs } from "./serialization";
import { fromByteArray } from "base64-js";

if ((globalThis as any).Android) {
    bindPassRequestBody((id, body) =>
        (globalThis as any).Android.passRequestBody(id, fromByteArray(body))
    );
}

(globalThis as any).process = {
    platform: "browser"
};

function syncRequest(pathComponents: string[], ...args) {
    const request = new XMLHttpRequest();
    const searchParams = new URLSearchParams();
    searchParams.set("body", encodeURIComponent(JSON.stringify(args)));
    request.open(
        "GET",
        pathComponents.join("/") + "?" + searchParams.toString(),
        false
    );
    request.send();

    const contentType = request.getResponseHeader("content-type");
    let data: any;

    if (contentType?.startsWith("application/octet-stream"))
        data = new Uint8Array(request.response);
    else {
        data = request.responseText;
        if (contentType?.startsWith("application/json")) {
            data = JSON.parse(data);
        }
    }

    if (request.status >= 299) {
        throw data;
    }

    return data;
}

async function fetchCall(pathComponents: string[], ...args) {
    const url = new URL(self.location.origin);
    url.pathname = pathComponents.join("/");

    const response = await fetch(url.toString(), {
        method: "POST",
        body: serializeArgs(args)
    });

    const contentType = response.headers.get("content-type");

    let data = null;
    if (contentType?.startsWith("text/plain")) {
        data = await response.text();
    } else if (contentType?.startsWith("application/json")) {
        data = await response.json();
    } else if (contentType?.startsWith("application/octet-stream")) {
        data = new Uint8Array(await response.arrayBuffer());
    } else {
        console.error(
            "Unknown content-type in IPC return call. Using arrayBuffer"
        );
        data = await response.arrayBuffer();
    }

    if (response.status >= 299) {
        throw data;
    }

    return data;
}

function recurseInProxy(target: Function, pathComponents: string[] = []) {
    return new Proxy(target, {
        apply: (target, _, argArray) => {
            return target(pathComponents, ...argArray);
        },
        get: (_, p) => {
            pathComponents.push(p as string);
            return recurseInProxy(target, pathComponents);
        }
    });
}

export function rpcSync<T>() {
    return recurseInProxy(syncRequest) as AwaitNone<T>;
}
globalThis.rpcSync = rpcSync;

export default function rpc<T>() {
    return recurseInProxy(fetchCall) as AwaitAll<T>;
}
globalThis.rpc = rpc as any;

globalThis.onPush = {};

const dispatchMessage = (messageType: string, message: string) => {
    const callback = globalThis.onPush[messageType];
    if (!callback) return false;

    callback(message);
    return true;
};

globalThis.push = (messageType: string, message: string) => {
    // try once
    if (!dispatchMessage(messageType, message)) {
        setTimeout(() => {
            // try twice
            if (!dispatchMessage(messageType, message))
                throw `No onPush callback for message type [${messageType}]. Received message [${message}]`;
        }, 150);
    }
};

// use a websocket for nodejs
const platform = await (rpc() as any).platform();
const wsPlatforms = [Platform.NODE, Platform.WEBCONTAINER, Platform.DOCKER];
if (wsPlatforms.includes(platform)) {
    const url =
        (self.location.protocol === "http:" ? "ws:" : "wss:") +
        "//" +
        self.location.host;
    const ws = new WebSocket(url);
    ws.onmessage = ({ data }) => {
        const { messageType, message } = JSON.parse(data);
        globalThis.push(messageType, message);
    };
    ws.onclose = () => window.location.reload();
}

onPush["reload"] = () => window.location.reload();

globalThis.sourceMapConsumer = SourceMapConsumer;
