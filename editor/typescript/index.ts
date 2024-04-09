import type { methods } from "./worker";

function recurseInProxy(target: Function, methodPath: string[] = []) {
    return new Proxy(target, {
        apply: (target, _, argArray) => {
            return target(methodPath, ...argArray);
        },
        get: (_, p) => {
            methodPath.push(p as string);
            return recurseInProxy(target, methodPath);
        }
    });
}

export class tsWorker {
    worker: Worker;
    private reqsCount = 0;
    private reqs = new Map<number, Function>();
    private isReady = false;
    private readyAwaiter: Function[] = [];

    private postMessage(methodPath: string[], ...args: any) {
        const id = ++this.reqsCount;
        return new Promise((resolve) => {
            this.reqs.set(id, resolve);
            this.worker.postMessage({ id, methodPath, args });
        });
    }

    constructor() {
        this.worker = new Worker("worker-ts.js", { type: "module" });
        this.worker.onmessage = (message) => {
            if (message.data.ready) {
                this.isReady = true;
                this.readyAwaiter.forEach((resolve) => resolve());
                return;
            }

            const { id, data } = message.data;
            const promiseResolve = this.reqs.get(id);
            promiseResolve(data);
            this.reqs.delete(id);
        };
    }

    async ready(): Promise<void> {
        if (this.isReady) return;

        return new Promise((resolve) => {
            this.readyAwaiter.push(resolve);
        });
    }
    
    call = () =>
        recurseInProxy(this.postMessage.bind(this)) as AwaitAll<typeof methods>;
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
