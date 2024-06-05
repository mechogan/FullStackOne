import path from "path";
import { Instance } from "./instance";
import { fileURLToPath } from "url";
import type { AdapterEditor } from "../../../editor/rpc";
import os from "os";
import { initAdapter } from "./adapter";
import { Project } from "../../../editor/api/projects/types";
import esbuild from "esbuild";
import { WebSocket } from "ws";
import { WebSocketServer } from "./connectivity/websocketServer";
import { Bonjour } from "./connectivity/bonjour";
import { initAdapterEditor } from "./adapterEditor";
import { initConnectivity } from "./connectivity";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorDirectory = path.resolve(__dirname, "editor");

export class InstanceEditor extends Instance {
    static singleton: InstanceEditor;

    rootDirectory: string;
    baseJS: string = path.resolve(__dirname, "js", "index.js");
    configDirectory: string = process.env.CONFIG_DIR || ".config/fullstacked";
    nodeModulesDirectory: string = this.configDirectory + "/node_modules";
    cacheDirectory: string = ".cache/fullstacked";

    wsServer: WebSocketServer;
    bonjour: Bonjour;
    private instances: Instance[] = [];

    adapter: AdapterEditor = null;

    launchURL: string;

    constructor(launchURL: string) {
        const rootDirectory = os.homedir();

        super({
            title: "FullStacked Editor",
            location: editorDirectory,
            createdDate: null
        }, rootDirectory);

        this.rootDirectory = rootDirectory;

        InstanceEditor.singleton = this;

        this.launchURL = launchURL;

        initConnectivity(this);

        const adapter = initAdapter(editorDirectory, "node", this.broadcast.bind(this));
        this.adapter = initAdapterEditor(adapter, this, esbuild);
    }

    getInstances() { return this.instances }

    createNewInstance(project: Project) {
        const instance = new Instance(project);
        instance.start();
        this.instances.push(instance);
    }

    broadcast(data: string) {
        this.instances.forEach(instance => instance.push("peerData", data));
    }

    override wsOnConnection(ws: WebSocket): void {
        super.wsOnConnection(ws);
        if (this.launchURL) {
            this.push("launchURL", this.launchURL);
            this.launchURL = null;
        }
    }
}
