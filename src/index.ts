import { SourceMapConsumer } from "source-map-js";
import { decodeUint8Array } from "./Uint8Array";

(globalThis as any).process = {
    platform: "browser"
};

function syncRequest(pathComponents: string[], ...args) {
    const request = new XMLHttpRequest();
    request.open("POST", pathComponents.join("/"), false);
    request.send(JSON.stringify(args));

    const contentType = request.getResponseHeader("content-type");
    let data: any;

    if (contentType?.startsWith("application/octet-stream"))
        data = new Uint8Array(request.response);
    else {
        data = request.responseText;
        if (contentType?.startsWith("application/json")) {
            data = JSON.parse(data, decodeUint8Array);
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
        body: JSON.stringify(args)
    });

    const contentType = response.headers.get("content-type");

    let data: any;

    if (contentType?.startsWith("application/octet-stream"))
        data = new Uint8Array(await response.arrayBuffer());
    else {
        data = await response.text();
        if (contentType?.startsWith("application/json")) {
            data = JSON.parse(data, decodeUint8Array);
        }
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
    return recurseInProxy(syncRequest);
}
globalThis.rpcSync = rpcSync;

export default function rpc<T>() {
    return recurseInProxy(fetchCall);
}
globalThis.rpc = rpc;

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
if (platform === "node") {
    const url =
        (self.location.protocol === "http:" ? "ws:" : "wss:") +
        "//" +
        self.location.host;
    const ws = new WebSocket(url);
    ws.onmessage = ({ data }) => {
        const { messageType, message } = JSON.parse(data);
        globalThis.push(messageType, message);
    };
}

globalThis.sourceMapConsumer = SourceMapConsumer;
