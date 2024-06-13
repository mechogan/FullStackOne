import path from "path";
import { Instance } from "./instance";
import type { AdapterEditor } from "../../../editor/rpc";
import os from "os";
import { initAdapter } from "./adapter";
import { Project } from "../../../editor/api/projects/types";
import esbuild from "esbuild";
import { WebSocket } from "ws";
import type { WebSocketServer } from "./connectivity/websocketServer";
import type { Bonjour } from "./connectivity/bonjour";
import { initAdapterEditor } from "./adapterEditor";

const isWebContainer = !!process.versions?.webcontainer;

export class InstanceEditor extends Instance {
    static singleton: InstanceEditor;

    rootDirectory: string;
    baseJS: string;
    configDirectory: string = process.env.CONFIG_DIR || ".config/fullstacked";
    nodeModulesDirectory: string = this.configDirectory + "/node_modules";
    cacheDirectory: string = ".cache/fullstacked";

    wsServer: WebSocketServer;
    bonjour: Bonjour;
    private instances: Instance[] = [];

    adapter: AdapterEditor = null;

    launchURL: string;

    constructor(launchURL: string, currentDir: string) {
        const rootDirectory = os.homedir();
        const editorDirectory = path.resolve(currentDir, "editor");

        super(
            {
                title: "FullStacked Editor",
                location: editorDirectory,
                createdDate: null
            },
            rootDirectory
        );

        this.rootDirectory = rootDirectory;
        this.baseJS = path.resolve(currentDir, "js", "index.js");

        InstanceEditor.singleton = this;

        this.launchURL = launchURL;

        if (!isWebContainer) {
            import("./connectivity").then(({ initConnectivity }) =>
                initConnectivity(this)
            );
        }

        const adapter = initAdapter(
            editorDirectory,
            isWebContainer ? "webcontainer" : "node",
            null
        );
        this.adapter = initAdapterEditor(adapter, this, esbuild);
    }

    getInstances() {
        return this.instances;
    }

    createNewInstance(project: Project) {
        const instance = new Instance(project);
        instance.start();
        this.instances.push(instance);
    }

    override wsOnConnection(ws: WebSocket): void {
        super.wsOnConnection(ws);
        if (this.launchURL) {
            this.push("launchURL", this.launchURL);
            this.launchURL = null;
        }
    }
}
