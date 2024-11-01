import type EsbuildModuleType from "esbuild";
import type { Bonjour } from "./connectivity/bonjour";
import fs from "fs";
import mime from "mime";
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
import fastQueryString from "fast-querystring";
import os from "os";
import {
    convertObjectToArray,
    deserializeArgs,
    serializeArgs
} from "../../../src/serialization";

export type EsbuildFunctions = {
    load: () => Promise<typeof EsbuildModuleType>;
    install: () => Promise<void>;
};

export type PushFunction = (
    id: string,
    messageType: string,
    data: string
) => void;
export type OpenFunction = (
    id: string,
    project?: Project
) => void | Promise<void>;
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

    if (!fs.existsSync(directories.rootDirectory))
        fs.mkdirSync(directories.rootDirectory, { recursive: true });

    // MIGRATION 2024-10-26 : Convert title based location to id

    const oldConfigPath = os.homedir() + "/.config/fullstacked";
    const newConfigPath =
        directories.rootDirectory + "/" + directories.configDirectory;
    if (fs.existsSync(oldConfigPath) && !fs.existsSync(newConfigPath)) {
        fs.renameSync(
            oldConfigPath,
            directories.rootDirectory + "/" + directories.configDirectory
        );
    }

    // END

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
    const adapter = createAdapter(
        directories.rootDirectory,
        platform,
        mainBroadcast
    );
    const mainAdapter: AdapterEditor = {
        ...adapter,

        migrate: async (project) => {
            const oldDirectory = os.homedir() + "/" + project.location;
            const newDirectory = directories.rootDirectory + "/" + project.id;

            const oldDirectoryExists = fs.existsSync(oldDirectory);
            const newDirectoryExists = fs.existsSync(newDirectory);

            if (oldDirectoryExists && !newDirectoryExists) {
                await fs.promises.rename(oldDirectory, newDirectory);
            }
        },

        directories,
        fs: upgradeFS(editorDirectory, adapter.fs),
        connectivity,
        esbuild: {
            version: async () => esbuildModule.version,
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

            return open(instance.id, instance.project);
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
    editorDirectory: string,
    defaultFS: Adapter["fs"]
): AdapterEditor["fs"] {
    let fsEditor = {};
    Object.entries(defaultFS).forEach(([name, method]) => {
        fsEditor[name] = async (...args: any[]) => {
            let absolutePath = !!args.find((arg) => arg?.absolutePath);

            if (absolutePath) {
                // @ts-ignore
                return method(...args);
            }

            let path = editorDirectory + "/" + args[0];
            switch (name) {
                case "exists":
                    let stats: Awaited<
                        ReturnType<(typeof fs)["promises"]["stat"]>
                    >;
                    try {
                        stats = await fs.promises.stat(path);
                    } catch (e) {
                        return null;
                    }
                    return { isFile: stats.isFile() };
                case "readFile":
                    return fs.promises.readFile(path, {
                        encoding: args?.[1]?.encoding
                    });
            }
        };
    });

    return fsEditor as AdapterEditor["fs"];
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

        const pathAndQuery = path.split("?");

        // get first element as pathname
        let pathname = decodeURIComponent(pathAndQuery.shift());

        // the rest can be used as query
        const query = pathAndQuery.join("?");
        let bodyFromQuery = false;
        if (query.length) {
            const searchParams = fastQueryString.parse(query);
            const maybeBody: string = searchParams["body"];
            if (maybeBody) {
                bodyFromQuery = true;
                body = te.encode(decodeURIComponent(maybeBody));
            }
        }

        // remove trailing slash
        if (pathname?.endsWith("/")) pathname = pathname.slice(0, -1);

        // remove leading slash
        if (pathname?.startsWith("/")) pathname = pathname.slice(1);

        // check for [path]/index.html
        let maybeIndexHTML = pathname + (pathname ? "/" : "") + "index.html";
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
        // ipc methods
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
                        ? bodyFromQuery
                            ? JSON.parse(td.decode(body))
                            : deserializeArgs(body)
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

                response.mimeType = "text/plain";
                if (responseBody) {
                    if (typeof responseBody === "string") {
                        response.data = te.encode(responseBody);
                    } else if (ArrayBuffer.isView(responseBody)) {
                        response.mimeType = "application/octet-stream";
                        response.data = new Uint8Array(responseBody.buffer);
                    } else {
                        response.mimeType = "application/json";
                        response.data = te.encode(JSON.stringify(responseBody));
                    }
                } else {
                    delete response.data;
                }
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
