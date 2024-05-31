import type { Peer, PeerConnection, PeerNearby } from "../src/adapter/connectivity";
import type { Adapter } from "../src/adapter/fullstacked";
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
            nearby(): PeerNearby[],
            connections(): PeerConnection[]
        },
        advertise: {
            start(me: Peer["id"]): void,
            stop(): void
        },
        disconnect(peerConnection: PeerConnection): void
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
