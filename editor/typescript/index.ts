import type { methods } from "./worker";

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
export const WorkerTS = {
    reqs: new Map<number, Function>(),
    working: null as () => void,
    start,
    dispose,
    call: () =>
        recurseInProxy(postMessage) as unknown as AwaitAll<
            typeof methods
        >,

}


function postMessage(methodPath: string[], ...args: any) {
    if (!worker) return;

    const id = ++reqsCount;
    return new Promise((resolve) => {
        WorkerTS.reqs.set(id, resolve);
        worker.postMessage({ id, methodPath, args });
        WorkerTS.working?.();
    });
}

function start(workingDirectory: string) {
    if (worker) return;

    return new Promise<void>((resolve) => {
        worker = new Worker("worker-ts.js", { type: "module" });
        worker.onmessage = async (message) => {
            if (message.data.ready) {
                const platform = await rpc().platform();
                worker.postMessage({ platform });
                await WorkerTS.call().start(workingDirectory);
                resolve();
            } else if (message.data.body) {
                const { id, body } = message.data;
                (globalThis as any).Android?.passRequestBody(id, body);
                worker.postMessage({ request_id: id });
            } else {
                const { id, data } = message.data;
                const promiseResolve = WorkerTS.reqs.get(id);
                promiseResolve(data);
                WorkerTS.reqs.delete(id);
            }

            WorkerTS.working?.();
        };
    });
}

function dispose() {
    worker?.terminate();
    worker = null;

    for (const promiseResolve of WorkerTS.reqs.values()) {
        try {
            promiseResolve(undefined);
        } catch (e) {}
    }
    WorkerTS.reqs.clear();
    reqsCount = 0;

    WorkerTS.working?.();
}