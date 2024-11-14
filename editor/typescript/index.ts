import type { methods } from "./worker";
import { createSubscribable } from "../store";

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

function restart() {
    if (!directory) {
        throw Error("Tried to restart WorkerTS before calling start");
    }

    WorkerTS.dispose();
    return WorkerTS.start(directory);
}

let readyPromise: Promise<void>;

function start(workingDirectory: string) {
    directory = workingDirectory;

    if (!readyPromise) {
        readyPromise = new Promise<void>((resolve) => {
            worker = new Worker("worker-ts.js", { type: "module" });
            worker.onmessage = async (message) => {
                if (message.data.ready) {
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

    return readyPromise;
}

function dispose() {
    readyPromise = null;
    worker?.terminate();
    worker = null;

    for (const promiseResolve of requests.values()) {
        try {
            promiseResolve(undefined);
        } catch (e) {}
    }
    requests.clear();
    reqsCount = 0;

    tsRequests.notify();
}
