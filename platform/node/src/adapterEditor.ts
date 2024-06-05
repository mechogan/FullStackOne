import type { AdapterEditor } from "../../../editor/rpc";
import type { Adapter } from "../../../src/adapter/fullstacked";
import type { InstanceEditor as InstanceEditorNode } from "./instanceEditor";
import type { InstanceEditor as InstanceEditorElectron } from "../../electron/src/instanceEditor";
import type { Instance as InstanceNode } from "./instance";
import type { Instance as InstanceElectron } from "../../electron/src/instance";
import type esbuildModule from "esbuild";
import fs from "fs";
import { Project } from "../../../editor/api/projects/types";
import { build, merge } from "./build";
import { getComputerName } from "./connectivity/bonjour";

export function initAdapterEditor(
    adapter: Adapter,
    instanceEditor: InstanceEditorNode | InstanceEditorElectron,
    esbuild: typeof esbuildModule
): AdapterEditor {
    const writeFile: AdapterEditor["fs"]["writeFile"] = async (
        file,
        data,
        options
    ) => {
        const filePath = instanceEditor.rootDirectory + "/" + file;

        if (options?.recursive) {
            const directory = filePath.split("/").slice(0, -1);
            await fs.promises.mkdir(directory.join("/"), {
                recursive: true
            });
        }

        return fs.promises.writeFile(filePath, data, options);
    };

    return {
        ...adapter,
        fs: {
            ...adapter.fs,
            readFile: (
                path,
                options?: { encoding?: "utf8"; absolutePath?: boolean }
            ) => {
                if (options?.absolutePath) {
                    return fs.promises.readFile(
                        instanceEditor.rootDirectory + "/" + path,
                        options
                    );
                }
                return adapter.fs.readFile(path, options);
            },
            writeFile: async (file, data, options) => {
                if (options?.absolutePath) {
                    return writeFile(file, data, options);
                }
                return adapter.fs.writeFile(file, data, options);
            },
            writeFileMulti: (files, options) => {
                if (options?.absolutePath) {
                    return Promise.all(
                        files.map(({ path, data }) =>
                            writeFile(path, data, options)
                        )
                    );
                }
                return adapter.fs.writeFileMulti(files, options);
            },
            unlink: (path, options) => {
                if (options?.absolutePath) {
                    return fs.promises.unlink(
                        instanceEditor.rootDirectory + "/" + path
                    );
                }
                return adapter.fs.unlink(path);
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
                        instanceEditor.rootDirectory + "/" + path,
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
                return adapter.fs.readdir(path, options);
            },
            mkdir: async (path, options) => {
                if (options?.absolutePath) {
                    await fs.promises.mkdir(
                        instanceEditor.rootDirectory + "/" + path,
                        { recursive: true }
                    );
                    return;
                }
                return adapter.fs.mkdir(path);
            },
            rmdir: (path, options) => {
                if (options?.absolutePath) {
                    return fs.promises.rm(
                        instanceEditor.rootDirectory + "/" + path,
                        { recursive: true }
                    );
                }
                return adapter.fs.rmdir(path);
            },
            stat: async (path, options) => {
                if (options?.absolutePath) {
                    const stats: any = await fs.promises.stat(
                        instanceEditor.rootDirectory + "/" + path
                    );
                    stats.isDirectory = stats.isDirectory();
                    stats.isFile = stats.isFile();
                    return stats;
                }
                return adapter.fs.stat(path);
            },
            lstat: async (path, options) => {
                if (options?.absolutePath) {
                    const stats: any = await fs.promises.lstat(
                        instanceEditor.rootDirectory + "/" + path
                    );
                    stats.isDirectory = stats.isDirectory();
                    stats.isFile = stats.isFile();
                    return stats;
                }
                return adapter.fs.lstat(path);
            },
            exists: async (
                path: string,
                options?: { absolutePath?: boolean }
            ) => {
                if (options?.absolutePath) {
                    try {
                        const stats = await fs.promises.stat(
                            instanceEditor.rootDirectory + "/" + path
                        );
                        return { isFile: stats.isFile() };
                    } catch (e) {
                        return null;
                    }
                }
                return adapter.fs.exists(path);
            }
        },

        directories: {
            root: instanceEditor.rootDirectory,
            cache: instanceEditor.cacheDirectory,
            config: instanceEditor.configDirectory,
            nodeModules: instanceEditor.nodeModulesDirectory
        },

        esbuild: {
            check: () => true,
            install: () => null
        },

        build: async (project: Project) => {
            const entryPoint = [
                instanceEditor.rootDirectory +
                    "/" +
                    project.location +
                    "/index.ts",
                instanceEditor.rootDirectory +
                    "/" +
                    project.location +
                    "/index.tsx",
                instanceEditor.rootDirectory +
                    "/" +
                    project.location +
                    "/index.js",
                instanceEditor.rootDirectory +
                    "/" +
                    project.location +
                    "/index.jsx"
            ].find((file) => fs.existsSync(file));

            if (!entryPoint) return null;

            const mergedFile = await merge(
                instanceEditor.baseJS,
                entryPoint,
                instanceEditor.rootDirectory +
                    "/" +
                    instanceEditor.cacheDirectory
            );

            const outdir =
                instanceEditor.rootDirectory +
                "/" +
                project.location +
                "/.build";
            const result = build(
                esbuild.buildSync,
                mergedFile,
                "index",
                outdir,
                instanceEditor.rootDirectory +
                    "/" +
                    instanceEditor.nodeModulesDirectory
            );

            await fs.promises.unlink(mergedFile);

            return result?.errors;
        },
        run: (project: Project) => {
            instanceEditor.createNewInstance(project);
        },

        open: () => {},

        connectivity: {
            name: getComputerName(),
            peers: {
                nearby: () => {
                    return instanceEditor.bonjour.getPeersNearby();
                }
            },
            advertise: {
                start: (me) => {
                    instanceEditor.bonjour.startAdvertising(me);
                },
                stop: () => {
                    instanceEditor.bonjour.stopAdvertising();
                }
            },
            browse: {
                start: () => {
                    instanceEditor.bonjour.startBrowsing();
                },
                stop: () => {
                    instanceEditor.bonjour.stopBrowsing();
                }
            },
            open: null,
            requestConnection: null,
            respondToRequestConnection: (id, peerConnectionRequestStr) => {
                instanceEditor.wsServer.respondToConnectionRequest(
                    id,
                    peerConnectionRequestStr
                );
            },
            trustConnection: (id) => {
                instanceEditor.wsServer.trustConnection(id);
            },
            disconnect: (id) => {
                instanceEditor.wsServer.disconnect(id);
            },
            send: (id, data) => {
                instanceEditor.wsServer.send(id, data);
            },
            convey: (data) => {
                instanceEditor
                    .getInstances()
                    .forEach((instance: InstanceNode | InstanceElectron) =>
                        instance.push("peerData", data)
                    );
            }
        }
    };
}
