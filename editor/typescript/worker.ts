import ts from "typescript";
import type { AdapterEditor } from "../rpc";
import type { rpcSync as rpcSyncFn } from "../../src/index";
import type rpcFn from "../../src/index";
import type { Dirent } from "../../src/adapter/fs";

const rpc = globalThis.rpc as typeof rpcFn<AdapterEditor>;
const rpcSync = globalThis.rpcSync as typeof rpcSyncFn<AdapterEditor>;

// source: https://stackoverflow.com/a/69881039/9777391
function JSONCircularRemover() {
    const visited = new WeakSet();
    return (key, value) => {
        if (typeof value !== "object" || value === null) return value;

        if (visited.has(value)) {
            return "[Circular]";
        }

        visited.add(value);
        return value;
    };
}

self.onmessage = (message: MessageEvent) => {
    const { id, methodPath, args } = message.data;

    let method = methodPath.reduce(
        (obj, key) => (obj ? obj[key] : undefined),
        methods
    ) as any;

    if (typeof method === "function") {
        const data = method(...args);
        self.postMessage({
            id,
            data: data
                ? JSON.parse(JSON.stringify(data, JSONCircularRemover()))
                : undefined
        });
    }
};

const options: ts.CompilerOptions = {
    esModuleInterop: true,
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    lib: ["lib.dom.d.ts", "lib.es2023.d.ts"],
    jsx: ts.JsxEmit.React
};
let services: ts.LanguageService;
let sourceFiles: {
    [filename: string]: {
        contents: string;
        version: number;
    };
} = {};
let updateThrottler: ReturnType<typeof setTimeout> = null;

export let methods = {
    start(currentDirectory: string) {
        if(services) return;

        const servicesHost = initLanguageServiceHost(currentDirectory);
        services = ts.createLanguageService(
            servicesHost,
            ts.createDocumentRegistry()
        );
        methods = {
            ...methods,
            ...services
        };
    },
    updateFile(sourceFile: string, contents: string) {
        sourceFiles[sourceFile] = {
            contents,
            version: sourceFiles?.[sourceFile]?.version
                ? sourceFiles?.[sourceFile]?.version + 1
                : 1
        };

        if (updateThrottler) clearTimeout(updateThrottler);

        updateThrottler = setTimeout(() => {
            Promise.all(
                Object.entries(sourceFiles).map(
                    ([filename, { contents }]) =>
                        new Promise<void>(async (res) => {
                            if (
                                await rpc().fs.exists(filename, {
                                    absolutePath: true
                                })
                            ) {
                                await rpc().fs.writeFile(filename, contents, {
                                    absolutePath: true
                                });
                            } else {
                                delete sourceFiles[sourceFile];
                            }
                            res();
                        })
                )
            ).then(() => (updateThrottler = null));
        }, 2000);
    },
    ...services
};

const libCache = {};

const fsMap = new Map<string, string[] | boolean>();

const nodeModulesDirectory = await rpc().directories.nodeModules();
const resolveNodeModulePath = (path: string) =>
    nodeModulesDirectory + "/" + path.slice("node_modules/".length);

function initLanguageServiceHost(
    currentDirectory: string
): ts.LanguageServiceHost {
    return {
        getCompilationSettings: () => options,
        getScriptFileNames: function (): string[] {
            // console.log("getScriptFileNames");
            return Object.keys(sourceFiles);
        },
        getScriptVersion: function (fileName: string) {
            // console.log("getScriptVersion", fileName);

            if (
                fileName.includes("tsLib") ||
                fileName.startsWith("node_modules")
            ) {
                return "1";
            }

            if (!sourceFiles[fileName]) {
                sourceFiles[fileName] = {
                    version: 0,
                    contents: rpcSync().fs.readFile(fileName, {
                        encoding: "utf8",
                        absolutePath: true
                    }) as string
                }
            }

            return sourceFiles[fileName].version.toString();
        },
        getScriptSnapshot: function (fileName: string) {
            // console.log("getScriptSnapshot", fileName);

            if (fileName.includes("tsLib")) {
                if (!libCache[fileName]) {
                    libCache[fileName] = ts.ScriptSnapshot.fromString(
                        rpcSync().fs.readFile(fileName, {
                            encoding: "utf8"
                        }) as string
                    );
                }
                return libCache[fileName];
            } else if (fileName.startsWith("node_modules")) {
                if (!libCache[fileName]) {
                    libCache[fileName] = ts.ScriptSnapshot.fromString(
                        rpcSync().fs.readFile(resolveNodeModulePath(fileName), {
                            encoding: "utf8",
                            absolutePath: true
                        }) as string
                    );
                }
                return libCache[fileName];
            }

            if (!sourceFiles[fileName]) {
                sourceFiles[fileName] = {
                    version: 0,
                    contents: rpcSync().fs.readFile(fileName, {
                        encoding: "utf8",
                        absolutePath: true
                    }) as string
                }
            }

            return ts.ScriptSnapshot.fromString(
                sourceFiles[fileName].contents
            );
        },
        getCurrentDirectory: function () {
            // console.log("getCurrentDirectory");
            return currentDirectory;
        },
        getDefaultLibFileName: function (options: ts.CompilerOptions) {
            // console.log("getDefaultLibFileName");
            return "tsLib/lib.d.ts";
        },
        readFile: function (path: string) {
            // console.log("readFile", path);
            if (path.startsWith("node_modules")) {
                return rpcSync().fs.readFile(resolveNodeModulePath(path), {
                    absolutePath: true,
                    encoding: "utf8"
                }) as string;
            }
            return rpcSync().fs.readFile(path, {
                absolutePath: true,
                encoding: "utf8"
            }) as string;
        },
        fileExists: function (path: string) {
            // console.log("fileExists", path);
            if (path.startsWith("node_modules")) {
                const resolvedPath = resolveNodeModulePath(path);

                const resolvedPathComponents = resolvedPath.split("/");
                const filename = resolvedPathComponents.pop();
                const directory = resolvedPathComponents.join("/");

                let files = fsMap.get(directory);
                if (files === undefined) {
                    const exists = rpcSync().fs.exists(directory, {
                        absolutePath: true
                    });
                    if (!exists) {
                        fsMap.set(directory, false);
                        return false;
                    }

                    try {
                        files = (
                            rpcSync().fs.readdir(directory, {
                                withFileTypes: true,
                                absolutePath: true
                            }) as Dirent[]
                        )
                            .filter(({ isDirectory }) => !isDirectory)
                            .map(({ name }) => name);
                    } catch (e) {
                        files = false;
                    }

                    fsMap.set(directory, files);
                }

                return typeof files === "boolean"
                    ? files
                    : files.includes(filename);
            }
            return rpcSync().fs.exists(path, { absolutePath: true })?.isFile;
        }
    };
}

self.postMessage({ ready: true });
