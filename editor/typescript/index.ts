import type { methods } from "./worker";

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

export abstract class tsWorkerDelegate {
    abstract onReq(id: number): void;
    abstract onReqEnd(id: number): void;
}

export class tsWorker {
    static delegate?: tsWorkerDelegate;
    private worker: Worker;
    workingDirectory: string;
    private reqsCount = 0;
    private reqs = new Map<number, Function>();
    private isReady = false;
    private readyAwaiter: Function[] = [];

    private postMessage(methodPath: string[], ...args: any) {
        const id = ++this.reqsCount;
        if (tsWorker.delegate) tsWorker.delegate.onReq(id);
        return new Promise((resolve) => {
            this.reqs.set(id, resolve);
            this.worker.postMessage({ id, methodPath, args });
        });
    }

    dispose() {
        this.worker.terminate();
        for (const [id, promiseResolve] of this.reqs.entries()) {
            tsWorker.delegate.onReqEnd(id);
            promiseResolve(undefined);
        }
        this.reqs.clear();
        this.reqsCount = 0;
    }

    constructor(workingDirectory: string) {
        this.workingDirectory = workingDirectory;

        this.worker = new Worker("worker-ts.js", { type: "module" });
        this.worker.onmessage = (message) => {
            if (message.data.ready) {
                rpc().platform()
                    .then(platform => {
                        this.worker.postMessage({platform});
                        this.isReady = true;
                        this.readyAwaiter.forEach((resolve) => resolve());
                    });
                return;
            }

            if (message.data.body) {
                const { id, body } = message.data;
                (globalThis as any).Android?.passRequestBody(id, body);
                this.worker.postMessage({ request_id: id });
                return;
            }

            const { id, data } = message.data;
            const promiseResolve = this.reqs.get(id);
            promiseResolve(data);
            this.reqs.delete(id);
            if (tsWorker.delegate) tsWorker.delegate.onReqEnd(id);
        };
    }

    async ready(): Promise<void> {
        if (this.isReady) return;

        return new Promise((resolve) => {
            this.readyAwaiter.push(resolve);
        });
    }

    call = () =>
        recurseInProxy(this.postMessage.bind(this)) as unknown as AwaitAll<
            typeof methods
        >;
}

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
