import type rpcFn from "../src/index";
import type { Adapter } from "../src/adapter";
import type { Project } from "./api/projects/types";
import type esbuild from "esbuild";
import type { Peer } from "../platform/node/src/multipeer";

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

    peers: {
        advertise(): void | { error: { message: string, addresses: string[] } },
        browse(): void,
        pair(peer: Peer): Promise<boolean> 
    }
};

const rpc = globalThis.rpc as typeof rpcFn<AdapterEditor>;

export default rpc;
