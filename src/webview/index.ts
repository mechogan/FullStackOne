import "./Uint8Array";
import { SourceMapConsumer } from "source-map-js";

async function fetchCall(pathComponents: string[], ...args) {
    const url = new URL(window.location.origin);
    url.pathname = pathComponents.join("/");

    const response = await fetch(url.toString(), {
        method: "POST",
        body: JSON.stringify(args)
    });

    const contentType = response.headers.get("content-type");

    return contentType?.startsWith("application/json")
        ? response.json()
        : contentType?.startsWith("application/octet-stream")
          ? new Uint8Array(await response.arrayBuffer())
          : response.text();
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

export default function rpc<T>() {
    return recurseInProxy(fetchCall) as unknown as AwaitAll<T>;
}
(window as any).rpc = rpc;

type MakeFunction<T> = T extends string ? () => Promise<T> : T

type OnlyOnePromise<T> = T extends PromiseLike<any> ? T : Promise<T>;

type AwaitAll<T> = {
    [K in keyof T]: T[K] extends (...args: any) => any
        ? (
              ...args: T[K] extends (...args: infer P) => any ? P : never[]
          ) => OnlyOnePromise<
              T[K] extends (...args: any) => any ? ReturnType<T[K]> : any
          >
        : T[K] extends object 
            ? AwaitAll<T[K]>
            : () => Promise<T[K]>;
};

(window as any).onPush = {} as {
    [messageType: string]: (message: string) => void;
};

const dispatchMessage = (messageType: string, message: string) => {
    const callback = (window as any).onPush[messageType];
    if (!callback) return false;

    callback(message);
    return true;
};

(window as any).push = (messageType: string, message: string) => {
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
        (window.location.protocol === "http:" ? "ws:" : "wss:") +
        "//" +
        window.location.host;
    const ws = new WebSocket(url);
    ws.onmessage = ({ data }) => {
        const { messageType, message } = JSON.parse(data);
        (window as any).push(messageType, message);
    };
}

(window as any).sourceMapConsumer = SourceMapConsumer;
