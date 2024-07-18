import type EsbuildModuleType from "esbuild";
import type { Bonjour } from "./connectivity/bonjour";
import fs from "fs";
import mime from "mime";
import { decodeUint8Array } from "../../../src/Uint8Array";
import { AdapterEditor, SetupDirectories } from "../../../editor/rpc";
import { WebSocketServer } from "./connectivity/websocketServer";
import { createAdapter } from "./adapter";
import { Adapter } from "../../../src/adapter/fullstacked";
import { build } from "./build";
import { Project } from "../../../editor/api/config/types";
import { randomUUID } from "crypto";
import {
    getComputerName,
    getNetworkInterfacesInfo
} from "./connectivity/utils";
import { Platform } from "../../../src/platforms";

export type EsbuildFunctions = {
    load: () => Promise<typeof EsbuildModuleType>;
    install: () => Promise<void>;
};

export type PushFunction = (
    id: string,
    messageType: string,
    data: string
) => void;
export type OpenFunction = (id: string, project?: Project) => void;
export type OpenDirectoryFunction = (directory: string) => void;

export type Response = {
    data: Uint8Array;
    status: number;
    mimeType: string;
};

type Instance = {
    id: string;
    project: Project;
    adapter: Adapter;
};

const instances = new Map<string, Instance>();

export function main(
    platform: string,
    editorDirectory: string,
    tmpDirectory: string,
    baseJSFile: string,
    directories: SetupDirectories,
    esbuild: EsbuildFunctions,
    open: OpenFunction,
    push: PushFunction,
    openDirectory: OpenDirectoryFunction
) {
    let esbuildModule: typeof EsbuildModuleType;
    esbuild.load().then((e) => (esbuildModule = e));

    if (!fs.existsSync(tmpDirectory))
        fs.mkdirSync(tmpDirectory, { recursive: true });

    const createInstance: (project: Project) => Instance = (project) => {
        const broadcast: Adapter["broadcast"] = (data) =>
            push(
                null,
                "sendData",
                JSON.stringify({
                    projectId: project.id,
                    data
                })
            );

        return {
            id: randomUUID(),
            project,
            adapter: createAdapter(
                directories.rootDirectory + "/" + project.location,
                platform,
                broadcast
            )
        };
    };

    const { initConnectivity, connectivity } = createConnectivity(push);

    const mainBroadcast: Adapter["broadcast"] = (data) =>
        push(
            null,
            "sendData",
            JSON.stringify({
                projectId: null,
                data
            })
        );
    const adapter = createAdapter(editorDirectory, platform, mainBroadcast);
    const mainAdapter: AdapterEditor = {
        ...adapter,
        directories,
        fs: upgradeFS(directories.rootDirectory, adapter.fs),
        connectivity,
        esbuild: {
            baseJS: () =>
                fs.promises.readFile(baseJSFile, { encoding: "utf8" }),
            check: () => !!esbuildModule,
            install: async () => {
                await esbuild.install();
                esbuildModule = await esbuild.load();
            },
            tmpFile: {
                write: async (name: string, content: string) => {
                    const tmpFile = `${tmpDirectory}/${name}`;
                    await fs.promises.writeFile(tmpFile, content);
                    return tmpFile;
                },
                unlink: (name: string) => {
                    return fs.promises.unlink(`${tmpDirectory}/${name}`);
                }
            },
            async build(entryPoint, outdir) {
                const result = build(
                    esbuildModule.buildSync,
                    entryPoint,
                    "index",
                    outdir,
                    directories.rootDirectory +
                        "/" +
                        directories.nodeModulesDirectory
                );
                return result?.errors?.length ? result.errors : 1;
            }
        },
        run: (project) => {
            let instance = Array.from(instances.values()).find(
                ({ project: { location } }) => location === project.location
            );

            if (!instance) {
                instance = createInstance(project);
                instances.set(instance.id, instance);
            }

            open(instance.id, instance.project);
        },
        open: (project) => openDirectory(project.location)
    };

    if (platform !== Platform.WEBCONTAINER) {
        import("./connectivity/bonjour").then(({ Bonjour }) => {
            wsServer = new WebSocketServer();
            bonjour = new Bonjour(wsServer);
            initConnectivity();
        });
    }

    const handler = createHandler(mainAdapter);
    const close = (id: string) => {
        if (id === "FullStacked") {
            return new Promise((resolve) =>
                bonjour.bonjour.unpublishAll(resolve)
            );
        }
        instances.delete(id);
    };

    return { handler, close };
}

function upgradeFS(
    rootDirectory: string,
    defaultFS: Adapter["fs"]
): AdapterEditor["fs"] {
    const writeFile: AdapterEditor["fs"]["writeFile"] = async (
        file,
        data,
        options
    ) => {
        const filePath = rootDirectory + "/" + file;

        if (options?.recursive) {
            const directory = filePath.split("/").slice(0, -1);
            await fs.promises.mkdir(directory.join("/"), {
                recursive: true
            });
        }

        return fs.promises.writeFile(filePath, data, options);
    };

    return {
        ...defaultFS,
        readFile: (
            path,
            options?: { encoding?: "utf8"; absolutePath?: boolean }
        ) => {
            if (options?.absolutePath) {
                return fs.promises.readFile(
                    rootDirectory + "/" + path,
                    options
                );
            }
            return defaultFS.readFile(path, options);
        },
        writeFile: async (file, data, options) => {
            if (options?.absolutePath) {
                return writeFile(file, data, options);
            }
            return defaultFS.writeFile(file, data, options);
        },
        writeFileMulti: (files, options) => {
            if (options?.absolutePath) {
                return Promise.all(
                    files.map(({ path, data }) =>
                        writeFile(path, data, options)
                    )
                );
            }
            return defaultFS.writeFileMulti(files, options);
        },
        unlink: (path, options) => {
            if (options?.absolutePath) {
                return fs.promises.unlink(rootDirectory + "/" + path);
            }
            return defaultFS.unlink(path);
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
                    rootDirectory + "/" + path,
                    options
                );
                if (!options?.withFileTypes) {
                    return (items as unknown as string[]).map((filename) =>
                        filename.split("\\").join("/")
                    );
                }

                return items.map((item) => ({
                    ...item,
                    isDirectory: item.isDirectory()
                }));
            }
            return defaultFS.readdir(path, options);
        },
        mkdir: async (path, options) => {
            if (options?.absolutePath) {
                await fs.promises.mkdir(rootDirectory + "/" + path, {
                    recursive: true
                });
                return;
            }
            return defaultFS.mkdir(path);
        },
        rmdir: (path, options) => {
            if (options?.absolutePath) {
                return fs.promises.rm(rootDirectory + "/" + path, {
                    recursive: true
                });
            }
            return defaultFS.rmdir(path);
        },
        stat: async (path, options) => {
            if (options?.absolutePath) {
                const stats: any = await fs.promises.stat(
                    rootDirectory + "/" + path
                );
                stats.isDirectory = stats.isDirectory();
                stats.isFile = stats.isFile();
                return stats;
            }
            return defaultFS.stat(path);
        },
        lstat: async (path, options) => {
            if (options?.absolutePath) {
                const stats: any = await fs.promises.lstat(
                    rootDirectory + "/" + path
                );
                stats.isDirectory = stats.isDirectory();
                stats.isFile = stats.isFile();
                return stats;
            }
            return defaultFS.lstat(path);
        },
        exists: async (path: string, options?: { absolutePath?: boolean }) => {
            if (options?.absolutePath) {
                try {
                    const stats = await fs.promises.stat(
                        rootDirectory + "/" + path
                    );
                    return { isFile: stats.isFile() };
                } catch (e) {
                    return null;
                }
            }
            return defaultFS.exists(path);
        }
    };
}

const te = new TextEncoder();
const td = new TextDecoder();

const notFound: Response = {
    data: te.encode("Not Found"),
    status: 404,
    mimeType: "text/plain"
};

function createHandler(mainAdapter: AdapterEditor) {
    return async (id: string, path: string, body: Uint8Array) => {
        let response: Response = { ...notFound };

        const adapter = instances.get(id)?.adapter ?? mainAdapter;

        // remove query params
        let pathname = path.split("?").shift();

        // remove trailing slash
        if (pathname?.endsWith("/")) pathname = pathname.slice(0, -1);

        // remove leading slash
        if (pathname?.startsWith("/")) pathname = pathname.slice(1);

        // check for [path]/index.html
        let maybeIndexHTML = pathname + "/index.html";
        if ((await adapter.fs.exists(maybeIndexHTML))?.isFile) {
            pathname = maybeIndexHTML;
        }

        // we'll check for a built file
        if (
            pathname.endsWith(".js") ||
            pathname.endsWith(".css") ||
            pathname.endsWith(".map")
        ) {
            const maybeBuiltFile = ".build/" + pathname;
            if ((await adapter.fs.exists(maybeBuiltFile))?.isFile) {
                pathname = maybeBuiltFile;
            }
        }

        // static file serving
        if ((await adapter.fs.exists(pathname))?.isFile) {
            const data = (await adapter.fs.readFile(pathname)) as Uint8Array;
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
                adapter
            ) as any;

            if (method) {
                response.status = 200;

                const args =
                    body && body.length
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

        return response;
    };
}

let wsServer: WebSocketServer;
let bonjour: Bonjour;

function createConnectivity(push: PushFunction): {
    initConnectivity: () => void;
    connectivity: AdapterEditor["connectivity"];
} {
    const initConnectivity = () => {
        bonjour.onPeerNearby = (eventType, peerNearby) => {
            push(
                "FullStacked",
                "peerNearby",
                JSON.stringify({ eventType, peerNearby })
            );
        };

        wsServer.onPeerConnection = (id, type, state) => {
            push(
                "FullStacked",
                "peerConnection",
                JSON.stringify({ id, type, state })
            );
        };
        wsServer.onPeerData = (id, data) => {
            push("FullStacked", "peerData", JSON.stringify({ id, data }));
        };
    };

    const connectivity: AdapterEditor["connectivity"] = {
        infos: () => ({
            port: wsServer?.port,
            networkInterfaces: getNetworkInterfacesInfo()
        }),
        name: getComputerName(),
        peers: {
            nearby: () => {
                return bonjour?.getPeersNearby();
            }
        },
        advertise: {
            start: (me, networkInterface) => {
                bonjour?.startAdvertising(me, networkInterface);
            },
            stop: () => {
                bonjour?.stopAdvertising();
            }
        },
        browse: {
            start: () => {
                bonjour?.startBrowsing();
            },
            peerNearbyIsDead: (id) => {
                bonjour?.peerNearbyIsDead(id);
            },
            stop: () => {
                bonjour?.stopBrowsing();
            }
        },
        open: null,
        trustConnection: (id) => {
            wsServer?.trustConnection(id);
        },
        disconnect: (id) => {
            wsServer?.disconnect(id);
        },
        send: (id, data, pairing) => {
            wsServer?.send(id, data, pairing);
        },
        convey: (projectId, data) => {
            for (const instance of instances.values()) {
                if (instance.project.id !== projectId) continue;
                push(instance.id, "peerData", data);
            }
        }
    };

    return { initConnectivity, connectivity };
}
