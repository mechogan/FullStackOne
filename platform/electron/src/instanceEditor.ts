import type esbuild from "esbuild";
import type { AdapterEditor } from "../../../editor/rpc";
import path from "path";
import mime from "mime";
import os from "os";
import { shell } from "electron";
import { Instance } from "./instance";
import { decodeUint8Array } from "../../../src/Uint8Array";
import { initAdapter } from "../../node/src/adapter";
import { Project } from "../../../editor/api/projects/types";
import { WebSocketServer } from "../../node/src/connectivity/websocketServer";
import { initAdapterEditor } from "../../node/src/adapterEditor";
import { Bonjour } from "../../node/src/connectivity/bonjour";
import { initConnectivity } from "../../node/src/connectivity";

type Response = {
    data: Uint8Array;
    status: number;
    mimeType: string;
};

const te = new TextEncoder();
const td = new TextDecoder();

const notFound: Response = {
    data: te.encode("Not Found"),
    status: 404,
    mimeType: "text/plain"
};

const editorDirectory = path.resolve(__dirname, "..", "editor");

export class InstanceEditor extends Instance {
    static singleton: InstanceEditor;

    instancesCount = 1;
    private instances: Map<string, Instance> = new Map();

    rootDirectory: string;
    baseJS: string = path.resolve(__dirname, "..", "js", "index.js");
    configDirectory: string = ".config/fullstacked";
    nodeModulesDirectory: string = this.configDirectory + "/node_modules";
    cacheDirectory: string = ".cache/fullstacked";

    bonjour: Bonjour;
    wsServer: WebSocketServer;

    adapter: AdapterEditor = null;

    esbuild: {
        module: typeof esbuild;
        install: Function;
        load: Function;
    } = {
        module: null,
        install: null,
        load: null
    };

    constructor(esbuild: { install: Function; load: Function }) {
        const rootDirectory = os.homedir();

        super(
            {
                title: "FullStacked Editor",
                location: editorDirectory,
                createdDate: null
            },
            rootDirectory
        );

        this.rootDirectory = rootDirectory;

        this.esbuild.install = esbuild.install;
        this.esbuild.load = esbuild.load;

        InstanceEditor.singleton = this;

        initConnectivity(this);
        this.resetAdapter();
    }

    resetAdapter() {
        const adapter = initAdapter(editorDirectory, "electron", null);
        this.adapter = initAdapterEditor(adapter, this, this.esbuild.module);

        this.adapter.esbuild = {
            check: () => !!this.esbuild,
            install: () => {
                const progressListener = (data: {
                    step: number;
                    progress: number;
                }) => {
                    this.window.webContents.executeJavaScript(
                        `window.push("esbuildInstall", \`${JSON.stringify(data).replace(/\\/g, "\\\\")}\`)`
                    );
                };
                this.esbuild
                    .install(
                        this.rootDirectory + "/" + this.configDirectory,
                        progressListener.bind(this)
                    )
                    .then((esbuild) => {
                        this.esbuild.module = esbuild;
                        this.resetAdapter();
                    });
            }
        };

        this.adapter.open = (project: Project) => {
            let directory = this.rootDirectory + "/" + project.location;
            if (os.platform() === "win32")
                directory = directory.split("/").join("\\");
            shell.openPath(directory);
        };
    }

    getInstances() {
        return Array.from(this.instances.values());
    }

    createNewInstance(project: Project) {
        for (const activeInstance of this.instances.values()) {
            if (activeInstance.project.location === project.location) {
                activeInstance.restart();
                return;
            }
        }

        const instance = new Instance(project);
        const hostname = `app-` + this.instancesCount;
        this.instances.set(hostname, instance);
        instance.start(hostname);
        instance.window.on("close", () => this.instances.delete(hostname));
    }

    async requestListener(request: Request) {
        let response: Response = { ...notFound };

        const url = new URL(request.url);
        const hostname = url.hostname;

        const instance = this.instances.get(hostname) || this;

        // remove query params
        let pathname = url.pathname.split("?").shift();

        // remove trailing slash
        if (pathname?.endsWith("/")) pathname = pathname.slice(0, -1);

        // remove leading slash
        if (pathname?.startsWith("/")) pathname = pathname.slice(1);

        // check for [path]/index.html
        let maybeIndexHTML = pathname + "/index.html";
        if ((await instance.adapter.fs.exists(maybeIndexHTML))?.isFile) {
            pathname = maybeIndexHTML;
        }

        // we'll check for a built file
        if (
            pathname.endsWith(".js") ||
            pathname.endsWith(".css") ||
            pathname.endsWith(".map")
        ) {
            const maybeBuiltFile = ".build/" + pathname;
            if ((await instance.adapter.fs.exists(maybeBuiltFile))?.isFile) {
                pathname = maybeBuiltFile;
            }
        }

        // static file serving
        if ((await instance.adapter.fs.exists(pathname))?.isFile) {
            const data = (await instance.adapter.fs.readFile(
                pathname
            )) as Uint8Array;
            response = {
                status: 200,
                mimeType: mime.getType(pathname) || "text/plain",
                data
            };
        }
        // rpc methods
        else {
            const methodPath = pathname.split("/");
            let method = methodPath.reduce(
                (api, key) => (api ? api[key] : undefined),
                instance.adapter
            ) as any;

            if (method) {
                response.status = 200;

                const body = await request.arrayBuffer();
                const args =
                    body && body.byteLength
                        ? JSON.parse(td.decode(body), decodeUint8Array)
                        : [];

                let responseBody = method;

                if (typeof responseBody === "function") {
                    try {
                        responseBody = responseBody(...args);
                    } catch (e) {
                        response.status = 299;
                        responseBody = e;
                    }
                }

                // await all promises and functions
                while (responseBody instanceof Promise) {
                    try {
                        responseBody = await responseBody;
                    } catch (e) {
                        response.status = 299;
                        responseBody = e;
                    }
                }

                let type = "text/plain";
                if (responseBody) {
                    if (ArrayBuffer.isView(responseBody)) {
                        type = "application/octet-stream";
                        responseBody = new Uint8Array(responseBody.buffer);
                    } else {
                        if (typeof responseBody !== "string") {
                            type = "application/json";
                            responseBody = JSON.stringify(responseBody);
                        }
                        responseBody = te.encode(responseBody);
                    }
                    response.data = responseBody;
                } else {
                    delete response.data;
                }

                response.mimeType = type;
            }
        }

        return new Response(response.data, {
            status: response.status,
            headers: {
                ["Content-Type"]: response.mimeType,
                ["Content-Length"]: response.data?.byteLength?.toString() || "0"
            }
        });
    }

    async start(hostname: string) {
        this.esbuild.module = await this.esbuild.load(
            this.rootDirectory + "/" + this.configDirectory
        );
        this.resetAdapter();
        return super.start(hostname);
    }
}
