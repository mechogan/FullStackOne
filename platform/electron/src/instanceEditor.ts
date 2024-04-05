import { Instance } from "./instance";
import path from "path";
import type { AdapterEditor } from "../../../editor/rpc";
import mime from "mime";
import { decodeUint8Array } from "../../../src/Uint8Array";
import { initAdapter } from "../../node/src/adapter";
import os from "os";
import fs from "fs";
import { Project } from "../../../editor/api/projects/types";
import { build, merge } from "../../node/src/build";
import type esbuild from "esbuild";
import { shell } from "electron";
import { installEsbuild, loadEsbuild } from "./esbuild";

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
    instancesCount = 1;
    instances: Map<string, Instance> = new Map();

    static rootDirectory: string = os.homedir();
    baseJS: string = path.resolve(__dirname, "..", "js", "index.js");
    configDirectory: string = ".config/fullstacked";
    nodeModulesDirectory: string = this.configDirectory + "/node_modules";
    cacheDirectory: string = ".cache/fullstacked";

    adapter: AdapterEditor = null;

    esbuild: typeof esbuild;

    constructor() {
        super({
            title: "FullStacked Editor",
            location: editorDirectory,
            createdDate: null
        });

        const writeFile: AdapterEditor["fs"]["writeFile"] = async (file, data, options) => {
            const filePath = InstanceEditor.rootDirectory + "/" + file;

            if(options?.recursive) {
                const directory = filePath.split("/").slice(0, -1);
                await fs.promises.mkdir(directory.join("/"), {recursive: true});
            }

            return fs.promises.writeFile(
                filePath,
                data,
                options
            );
        }

        const defaultAdapter = initAdapter(editorDirectory, "electron");
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
                writeFile: (file, data, options) => {
                    if (options?.absolutePath) {
                        return writeFile(file, data, options)
                    }
                    return defaultAdapter.fs.writeFile(file, data, options);
                },
                writeFileMulti: (files, options) => {
                    if (options?.absolutePath) {
                        return Promise.all(files.map(({ path, data }) => 
                            writeFile(
                                path, 
                                data,
                                options))
                            )
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
                    options?: { withFileTypes: true; absolutePath?: boolean }
                ) => {
                    if (options?.absolutePath) {
                        const items = await fs.promises.readdir(
                            InstanceEditor.rootDirectory + "/" + path,
                            options
                        );
                        if (!options?.withFileTypes) return items;

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
                    installEsbuild(
                        InstanceEditor.rootDirectory +
                            "/" +
                            this.configDirectory,
                        progressListener.bind(this)
                    ).then((esbuild) => (this.esbuild = esbuild));
                }
            },

            build: async (project: Project) => {
                const entryPoint = [
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
                    this.esbuild.buildSync,
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
                instance.window.on("close", () =>
                    this.instances.delete(hostname)
                );
            },

            open: (project: Project) => {
                let directory =
                    InstanceEditor.rootDirectory + "/" + project.location;
                if (os.platform() === "win32")
                    directory = directory.split("/").join("\\");
                shell.openPath(directory);
            }
        };
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
        this.esbuild = await loadEsbuild(
            InstanceEditor.rootDirectory + "/" + this.configDirectory
        );
        return super.start(hostname);
    }
}
