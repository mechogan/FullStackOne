import { Adapter } from "../src/adapter/fullstacked";
import type { Peer, PeerNearby } from "../src/connectivity/types";
import type { Project } from "./api/projects/types";
import type esbuild from "esbuild";

export type AdapterEditor = Adapter & {
    directories: {
        root: string;
        cache: string;
        config: string;
        nodeModules: string;
    };

    esbuild: {
        check(): boolean;
        install(): void;
    };

    build(project: Project): Promise<esbuild.BuildResult["errors"]> | 1;
    run(project: Project): void;

    open(project: Project): void;

    connectivity: {
        name: string,
        peers: {
            nearby(): PeerNearby[]
        },
        advertise: {
            start(me: Peer): void,
            stop(): void
        },
        browse: {
            start(): void,
            stop(): void
        },
        open(id: string): void,
        disconnect(id: string): void,
        requestConnection(id: string, peerConnectionRequestStr: string): void
        respondToRequestConnection(id: string, peerConnectionRequestStr: string): void,
        trustConnection(id: string): void,

        send(id: string, data: string): void,
        convey(data: string): void,
    }
};

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

const rpc = globalThis.rpc as unknown as () => AwaitAll<AdapterEditor>;

export default rpc;
