import type rpcFn from "../src/webview/index";
import type { Adapter } from "../src/adapter";
import type { Project } from "./api/projects/types";

export type AdapterEditor = Adapter & { 
    esbuild: {
        check(): boolean;
        install(): void;
    };

    build(project: Project): boolean;
    run(project: Project): void;
 }

const rpc = (window as any).rpc as typeof rpcFn<AdapterEditor>;

export default rpc;