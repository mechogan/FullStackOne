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
    private worker: Worker;
    private reqsCount = 0;
    reqs = new Map<number, Function>();

    private postMessage(methodPath: string[], ...args: any) {
        if (!this.worker) return;

        const id = ++this.reqsCount;
        return new Promise((resolve) => {
            this.reqs.set(id, resolve);
            this.worker.postMessage({ id, methodPath, args });
            this.working?.();
        });
    }

    working: () => void;

    dispose() {
        this.worker?.terminate();
        this.worker = null;

        for (const [id, promiseResolve] of this.reqs.entries()) {
            try {
                promiseResolve(undefined);
            } catch (e) {}
        }
        this.reqs.clear();
        this.reqsCount = 0;

        this.working?.();
    }

    async start(workingDirectory: string) {
        if (this.worker) return;

        return new Promise<void>((resolve) => {
            this.worker = new Worker("worker-ts.js", { type: "module" });
            this.worker.onmessage = async (message) => {
                if (message.data.ready) {
                    const platform = await rpc().platform();
                    this.worker.postMessage({ platform });
                    await this.call().start(workingDirectory);
                    resolve();
                } else if (message.data.body) {
                    const { id, body } = message.data;
                    (globalThis as any).Android?.passRequestBody(id, body);
                    this.worker.postMessage({ request_id: id });
                } else {
                    const { id, data } = message.data;
                    const promiseResolve = this.reqs.get(id);
                    promiseResolve(data);
                    this.reqs.delete(id);
                }

                this.working?.();
            };
        });
    }

    call = () =>
        recurseInProxy(this.postMessage.bind(this)) as unknown as AwaitAll<
            typeof methods
        >;
}

export const WorkerTS = new tsWorker();

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
