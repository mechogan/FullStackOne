import path from "path";
import { Instance } from "./instance";
import { fileURLToPath } from "url";
import type { AdapterEditor } from "../../../editor/rpc";
import os from "os";
import { initAdapter } from "./adapter";
import { Project } from "../../../editor/api/projects/types";
import fs from "fs";
import { build, merge } from "./build";
import esbuild from "esbuild";
import { WebSocket } from "ws";
import { WebSocketServer } from "./connectivity/websocketServer";
import { Bonjour, getComputerName } from "./connectivity/bonjour";
import { PEER_CONNECTION_TYPE } from "../../../src/connectivity/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorDirectory = path.resolve(__dirname, "editor");

export class InstanceEditor extends Instance {
    static singleton: InstanceEditor;
    static rootDirectory: string = os.homedir();
    baseJS: string = path.resolve(__dirname, "js", "index.js");
    configDirectory: string = process.env.CONFIG_DIR || ".config/fullstacked";
    nodeModulesDirectory: string = this.configDirectory + "/node_modules";
    cacheDirectory: string = ".cache/fullstacked";

    wsServer: WebSocketServer;
    bonjour: Bonjour;
    instances: Instance[] = [];

    adapter: AdapterEditor = null;

    launchURL: string;

    constructor(launchURL: string) {
        super({
            title: "FullStacked Editor",
            location: editorDirectory,
            createdDate: null
        });

        InstanceEditor.singleton = this;

        this.launchURL = launchURL;

        this.wsServer = new WebSocketServer();

        this.bonjour = new Bonjour(this.wsServer);
        this.bonjour.onPeerNearby = eventType => {
            this.push("peerNearby", eventType);
        }

        this.wsServer.onPeerConnectionLost = (id) => {
            this.push("peerConnectionLost", JSON.stringify({ id }));
        }
        this.wsServer.onPeerConnectionRequest = (id, peerConnectionRequestStr) => {
            this.push("peerConnectionRequest", JSON.stringify({ id, type: PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER, peerConnectionRequestStr }));
        }
        this.wsServer.onPeerData = (id, data) => {
            this.push("peerData", JSON.stringify({ id, data }));
        }

        const writeFile: AdapterEditor["fs"]["writeFile"] = async (
            file,
            data,
            options
        ) => {
            const filePath = InstanceEditor.rootDirectory + "/" + file;

            if (options?.recursive) {
                const directory = filePath.split("/").slice(0, -1);
                await fs.promises.mkdir(directory.join("/"), {
                    recursive: true
                });
            }

            return fs.promises.writeFile(filePath, data, options);
        };

        const defaultAdapter = initAdapter(editorDirectory);
        this.adapter = {
            ...defaultAdapter,
            fs: {
                ...defaultAdapter.fs,
                readFile: (
                    path,
                    options?: { encoding?: "utf8"; absolutePath?: boolean }
                ) => {
                    if (options?.absolutePath) {
                        return fs.promises.readFile(
                            InstanceEditor.rootDirectory + "/" + path,
                            options
                        );
                    }
                    return defaultAdapter.fs.readFile(path, options);
                },
                writeFile: async (file, data, options) => {
                    if (options?.absolutePath) {
                        return writeFile(file, data, options);
                    }
                    return defaultAdapter.fs.writeFile(file, data, options);
                },
                writeFileMulti: (files, options) => {
                    if (options?.absolutePath) {
                        return Promise.all(
                            files.map(({ path, data }) =>
                                writeFile(path, data, options)
                            )
                        );
                    }
                    return defaultAdapter.fs.writeFileMulti(files, options);
                },
                unlink: (path, options) => {
                    if (options?.absolutePath) {
                        return fs.promises.unlink(
                            InstanceEditor.rootDirectory + "/" + path
                        );
                    }
                    return defaultAdapter.fs.unlink(path);
                },
                readdir: async (
                    path,
                    options?: {
                        withFileTypes: true;
                        absolutePath?: boolean;
                        recursive?: boolean;
                    }
                ) => {
                    if (options?.absolutePath) {
                        const items = await fs.promises.readdir(
                            InstanceEditor.rootDirectory + "/" + path,
                            options
                        );
                        if (!options?.withFileTypes) {
                            return (items as unknown as string[]).map(
                                (filename) => filename.split("\\").join("/")
                            );
                        }

                        return items.map((item) => ({
                            ...item,
                            isDirectory: item.isDirectory()
                        }));
                    }
                    return defaultAdapter.fs.readdir(path, options);
                },
                mkdir: async (path, options) => {
                    if (options?.absolutePath) {
                        await fs.promises.mkdir(
                            InstanceEditor.rootDirectory + "/" + path,
                            { recursive: true }
                        );
                        return;
                    }
                    return defaultAdapter.fs.mkdir(path);
                },
                rmdir: (path, options) => {
                    if (options?.absolutePath) {
                        return fs.promises.rm(
                            InstanceEditor.rootDirectory + "/" + path,
                            { recursive: true }
                        );
                    }
                    return defaultAdapter.fs.rmdir(path);
                },
                stat: async (path, options) => {
                    if (options?.absolutePath) {
                        const stats: any = await fs.promises.stat(
                            InstanceEditor.rootDirectory + "/" + path
                        );
                        stats.isDirectory = stats.isDirectory();
                        stats.isFile = stats.isFile();
                        return stats;
                    }
                    return defaultAdapter.fs.stat(path);
                },
                lstat: async (path, options) => {
                    if (options?.absolutePath) {
                        const stats: any = await fs.promises.lstat(
                            InstanceEditor.rootDirectory + "/" + path
                        );
                        stats.isDirectory = stats.isDirectory();
                        stats.isFile = stats.isFile();
                        return stats;
                    }
                    return defaultAdapter.fs.lstat(path);
                },
                exists: async (
                    path: string,
                    options?: { absolutePath?: boolean }
                ) => {
                    if (options?.absolutePath) {
                        try {
                            const stats = await fs.promises.stat(
                                InstanceEditor.rootDirectory + "/" + path
                            );
                            return { isFile: stats.isFile() };
                        } catch (e) {
                            return null;
                        }
                    }
                    return defaultAdapter.fs.exists(path);
                }
            },

            directories: {
                root: InstanceEditor.rootDirectory,
                cache: this.cacheDirectory,
                config: this.configDirectory,
                nodeModules: this.nodeModulesDirectory
            },

            esbuild: {
                check: () => true,
                install: () => null
            },

            build: async (project: Project) => {
                const entryPoint = [
                    InstanceEditor.rootDirectory +
                    "/" +
                    project.location +
                    "/index.ts",
                    InstanceEditor.rootDirectory +
                    "/" +
                    project.location +
                    "/index.tsx",
                    InstanceEditor.rootDirectory +
                    "/" +
                    project.location +
                    "/index.js",
                    InstanceEditor.rootDirectory +
                    "/" +
                    project.location +
                    "/index.jsx"
                ].find((file) => fs.existsSync(file));

                if (!entryPoint) return null;

                const mergedFile = await merge(
                    this.baseJS,
                    entryPoint,
                    InstanceEditor.rootDirectory + "/" + this.cacheDirectory
                );

                const outdir =
                    InstanceEditor.rootDirectory +
                    "/" +
                    project.location +
                    "/.build";
                const result = build(
                    esbuild.buildSync,
                    mergedFile,
                    "index",
                    outdir,
                    InstanceEditor.rootDirectory +
                    "/" +
                    this.nodeModulesDirectory
                );

                await fs.promises.unlink(mergedFile);

                return result?.errors;
            },
            run: (project: Project) => {
                const instance = new Instance(project);
                instance.start();
                this.instances.push(instance);
            },

            open: () => { },

            connectivity: {
                name: getComputerName(),
                peers: {
                    nearby: () => {
                        return this.bonjour.getPeersNearby();
                    }
                },
                advertise: {
                    start: (me) => {
                        this.bonjour.startAdvertising(me)
                    },
                    stop: () => {
                        this.bonjour.stopAdvertising();
                    }
                },
                browse: {
                    start: () => {
                        this.bonjour.startBrowsing()
                    },
                    stop: () => {
                        this.bonjour.stopBrowsing();
                    }
                },
                open: null,
                requestConnection: null,
                respondToRequestConnection: (id, peerConnectionRequestStr) => {
                    this.wsServer.respondToConnectionRequest(id, peerConnectionRequestStr)
                },
                trustConnection: (id) => {
                    this.wsServer.trustConnection(id);
                },
                disconnect: (id) => {
                    this.wsServer.disconnect(id)
                },
                send: (id, data) => {
                    this.wsServer.send(id, data);
                },
                convey: (data) => {
                    this.instances.forEach(instance => instance.push("peerData", data));
                }
            }
        };
    }

    override wsOnConnection(ws: WebSocket): void {
        super.wsOnConnection(ws);
        if (this.launchURL) {
            this.push("launchURL", this.launchURL);
            this.launchURL = null;
        }
    }
}
