import { fetch } from "./fetch";
import { fs } from "./fs";

export type Adapter = {
    fs: fs;
    fetch: fetch;
    platform: string;
};

declare global {
    var rpc: () => AwaitAll<Adapter>;
    var rpcSync: () => AwaitNone<Adapter>;
    var onPush: {
        [messageType: string]: (message: string) => void;
    };
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

type AwaitNone<T> = {
    [K in keyof T]: T[K] extends (...args: any) => any
        ? (
              ...args: T[K] extends (...args: infer P) => any ? P : never[]
          ) => Awaited<
              T[K] extends (...args: any) => any ? ReturnType<T[K]> : any
          >
        : T[K] extends object
          ? AwaitNone<T[K]>
          : () => T[K];
};
