import type { methods } from "./worker";
import { parse } from "flatted";

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

export abstract class tsWorkerDelegate {
    abstract onCreate(): void;
    abstract onReq(id: number): void;
    abstract onReqEnd(id: number): void;
}

export class tsWorker {
    static delegate?: tsWorkerDelegate;
    worker: Worker;
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

    constructor(workingDirectory: string) {
        this.workingDirectory = workingDirectory;

        this.worker = new Worker("worker-ts.js", { type: "module" });
        this.worker.onmessage = (message) => {
            if (message.data.ready) {
                this.isReady = true;
                this.readyAwaiter.forEach((resolve) => resolve());
                if (tsWorker.delegate) tsWorker.delegate.onCreate();
                return;
            }

            const { id, data } = message.data;
            const promiseResolve = this.reqs.get(id);
            let parsed = data ? parse(data) : undefined;
            console.log(parsed);
            promiseResolve(parsed);
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
