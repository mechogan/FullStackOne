import type { methods } from "./worker";
import { createSubscribable } from "../store";
import { numberTo4Bytes } from "../../lib/bridge/serialization";
import platform, { Platform } from "../../lib/platform";
import { bridge } from "../../lib/bridge";
import core_message from "../../lib/core_message";

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

function recurseInProxy<T>(target: Function, methodPath: string[] = []) {
    return new Proxy(target, {
        apply: (target, _, argArray) => {
            return target(methodPath, ...argArray);
        },
        get: (_, p) => {
            methodPath.push(p as string);
            return recurseInProxy(target, methodPath);
        }
    }) as AwaitAll<T>;
}

let worker: Worker;
let reqsCount = 0;
let directory: string;

let requests = new Map<number, Function>();
const tsRequests = createSubscribable(() => requests);

export const WorkerTS = {
    working: tsRequests.subscription,
    start,
    restart,
    dispose,
    call: () =>
        recurseInProxy(postMessage) as unknown as AwaitAll<typeof methods>
};

function postMessage(methodPath: string[], ...args: any) {
    if (!worker) return;

    const id = ++reqsCount;
    return new Promise((resolve) => {
        requests.set(id, resolve);
        worker.postMessage({ id, methodPath, args });
        tsRequests.notify();
    });
}

async function restart() {
    if (!directory) {
        throw Error("Tried to restart WorkerTS before calling start");
    }

    WorkerTS.dispose();
    if (platform === Platform.WASM) {
        await preloadFS();
    }
    return WorkerTS.start(directory);
}

function passFileEvents(e: string) {
    if (!worker) return;
    WorkerTS.call().fileEvents(JSON.parse(e));
}

let readyPromise: Promise<void>;

function start(workingDirectory: string) {
    directory = workingDirectory;

    if (!readyPromise) {
        readyPromise = new Promise<void>(async (resolve) => {
            let workerPath = "worker-ts.js";

            if (platform === Platform.WASM) {
                const [mimeType, workerData] =
                    await getWorkerDataWASM("worker-ts.js");
                const blob = new Blob([workerData], { type: mimeType });
                workerPath = URL.createObjectURL(blob);
            }

            worker = new Worker(workerPath, { type: "module" });
            worker.onmessage = async (message) => {
                if (message.data.ready) {
                    if (platform === Platform.WASM) {
                        await preloadFS();
                    }
                    await WorkerTS.call().start(workingDirectory);
                    resolve();
                } else {
                    const { id, data } = message.data;
                    const promiseResolve = requests.get(id);
                    promiseResolve(data);
                    requests.delete(id);
                }

                tsRequests.notify();
            };
        });
    }

    core_message.addListener("file-event", passFileEvents);

    return readyPromise;
}

function dispose() {
    readyPromise = null;
    worker?.terminate();
    worker = null;
    core_message.removeListener("file-event", passFileEvents);

    for (const promiseResolve of requests.values()) {
        try {
            promiseResolve(undefined);
        } catch (e) {}
    }
    requests.clear();
    reqsCount = 0;

    tsRequests.notify();
}

///// WASM //////

const te = new TextEncoder();
function getWorkerDataWASM(workerPath: string) {
    const workerPathData = te.encode(workerPath);
    const payload = new Uint8Array([
        1, // Static File Serving
        2, // STRING
        ...numberTo4Bytes(workerPathData.byteLength),
        ...workerPathData
    ]);
    return bridge(payload);
}

function preloadFS() {
    return WorkerTS.call().preloadFS(
        globalThis.vfs(`projects/${directory}`),
        globalThis.vfs("editor/tsLib")
    );
}
