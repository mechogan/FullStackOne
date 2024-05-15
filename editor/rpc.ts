import type rpcFn from "../src/index";
import type { Adapter } from "../src/adapter/fullstacked";
import type { Project } from "./api/projects/types";
import type esbuild from "esbuild";
import type { Multipeer, Peer } from "../platform/node/src/multipeer";
import { info } from "console";

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
        info(): ReturnType<Multipeer["info"]>,
        advertise(): void,
        browse(): void,
        pair(peer: Peer): Promise<boolean> 
    }
};

const rpc = globalThis.rpc as typeof rpcFn<AdapterEditor>;

export default rpc;
