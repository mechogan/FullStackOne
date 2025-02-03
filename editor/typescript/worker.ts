import {
    IScriptSnapshot,
    createLanguageService,
    createDocumentRegistry,
    CompilerOptions,
    JsxEmit,
    LanguageService,
    LanguageServiceHost,
    ModuleKind,
    ModuleResolutionKind,
    ScriptSnapshot,
    ScriptTarget,
    isSourceFile,
    version
} from "typescript";
import { parsePackageName } from "./utils";
import fs_sync from "../lib/fs_sync";
import semver from "semver";

function removeSourceObjects(obj: any) {
    if (typeof obj === "object") {
        Object.keys(obj).forEach((key) => {
            if (key === "file" && isSourceFile(obj[key])) {
                obj[key] = "[File]";
            } else {
                obj[key] = removeSourceObjects(obj[key]);
            }
        });
    } else if (typeof obj === "function") {
        return "[Function]";
    }
    return obj;
}

self.onmessage = (message: MessageEvent) => {
    const { id, methodPath, args } = message.data;

    let method = methodPath.reduce(
        (obj, key) => (obj ? obj[key] : undefined),
        methods
    ) as any;

    if (typeof method === "function") {
        const response = method(...args);
        const data = removeSourceObjects(response);
        self.postMessage({
            id,
            data
        });
    }
};

const options: CompilerOptions = {
    esModuleInterop: true,
    module: ModuleKind.ES2022,
    target: ScriptTarget.ES2022,
    moduleResolution: ModuleResolutionKind.Node10,
    lib: [
        "lib.dom.d.ts",
        "lib.dom.iterable.d.ts",
        "lib.es2023.d.ts",
        "fullstacked.d.ts"
    ],
    jsx: JsxEmit.React
};
let services: LanguageService;

export let methods = {
    version() {
        return version;
    },
    preloadFS(
        files: { [path: string]: Uint8Array },
        tsLib: { [path: string]: Uint8Array },
        node_modules: { [path: string]: Uint8Array }
    ) {
        sourceFiles = {};

        const td = new TextDecoder();
        for (const [path, data] of Object.entries(files)) {
            if (data === null) continue;

            sourceFiles[path.slice("projects/".length)] = {
                contents: td.decode(data),
                version: 1
            };
        }

        for (const [path, data] of Object.entries(tsLib)) {
            if (data === null) continue;

            scriptSnapshotCache[path.slice("editor/".length)] =
                ScriptSnapshot.fromString(td.decode(data));
        }

        for (const [fileName, data] of Object.entries(node_modules)) {
            const modulePath = fileName.slice("projects/node_modules/".length);
            const { name, path } = parsePackageName(modulePath);

            let files = nodeModules.get(name);
            if (!files) {
                files = [];
                nodeModules.set(name, files);
            }
            const filePath = "node_modules/" + name + (path ? "/" + path : "");
            files.push(filePath);

            if (data !== null) {
                scriptSnapshotCache[filePath] = ScriptSnapshot.fromString(
                    td.decode(data)
                );
            }
        }
    },
    start(currentDirectory: string) {
        if (services) return;

        workingDirectory = currentDirectory;

        const servicesHost = initLanguageServiceHost();
        services = createLanguageService(
            servicesHost,
            createDocumentRegistry()
        );
        methods = {
            ...methods,
            ...services
        };
    },
    invalidateWorkingDirectory() {
        sourceFiles = null;
    },
    updateFile(sourceFile: string, contents: string) {
        makeSureSourceFilesAreLoaded();

        sourceFiles[sourceFile] = {
            contents,
            version: sourceFiles?.[sourceFile]?.version
                ? sourceFiles?.[sourceFile]?.version + 1
                : 1
        };
    },

    ...services,

    getDefinitionAtPositionExt(filePath: string, pos: number) {
        const defs = services.getDefinitionAtPosition(filePath, pos);

        return defs.map((def) => {
            if (def.fileName.startsWith("node_modules")) {
                const modulePath = def.fileName.slice("node_modules/".length);
                const { name, path } = parsePackageName(modulePath);
                const packgeVersion = packagesVersions?.get(name);
                return {
                    ...def,
                    fileName:
                        "node_modules/" +
                        name +
                        "/" +
                        packgeVersion +
                        "/" +
                        path
                };
            }

            return def;
        });
    }
};

let workingDirectory: string;
let packagesVersions: Map<string, string> = null;
let sourceFiles: {
    [filename: string]: {
        contents: string;
        version: number;
    };
} = null;
function makeSureSourceFilesAreLoaded() {
    if (sourceFiles !== null) {
        makeSurePackagesVersionsAreLoaded();
        return;
    }

    if (!workingDirectory) {
        throw new Error(
            "Trying to load source files before having set working directory."
        );
    }

    const files = fs_sync
        .readdir(workingDirectory)
        .map((filename) => workingDirectory + "/" + filename);

    sourceFiles = {};

    files.forEach((file) => {
        sourceFiles[file] = {
            contents: null,
            version: 0
        };
    });

    makeSurePackagesVersionsAreLoaded();
}

function makeSurePackagesVersionsAreLoaded() {
    if (packagesVersions !== null) return;

    const lockfile = workingDirectory + "/lock.json";
    if (sourceFiles[lockfile]) {
        packagesVersions = new Map();
        const lockfileContents = sourceFiles[lockfile].contents || fs_sync.readFile(lockfile);;
        recurseInLockfile(JSON.parse(lockfileContents));
    }
}

type PackagesLock = { [p: string]: PackageLock };

type PackageLock = {
    Version: string;
    Dependencies: PackagesLock;
};

function recurseInLockfile(lock: PackagesLock) {
    if (packagesVersions === null) {
        throw new Error("packagesVersions is null");
    }

    Object.entries(lock).forEach(([name, pkg]) => {
        const existingVersion = packagesVersions.get(name);

        if (existingVersion && semver.lt(pkg.Version, existingVersion)) {
            return;
        }

        packagesVersions.set(name, pkg.Version);
        if (pkg.Dependencies) recurseInLockfile(pkg.Dependencies);
    });
}

const scriptSnapshotCache: {
    [path: string]: IScriptSnapshot;
} = {};
let nodeModules: Map<string, string[]> = new Map();

function initLanguageServiceHost(): LanguageServiceHost {
    return {
        getCompilationSettings: () => options,
        getScriptFileNames: function (): string[] {
            // console.log("getScriptFileNames");

            makeSureSourceFilesAreLoaded();

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

            makeSureSourceFilesAreLoaded();

            return sourceFiles[fileName].version.toString();
        },
        getScriptSnapshot: function (fileName: string) {
            // console.log("getScriptSnapshot", fileName);

            if (fileName.startsWith("tsLib")) {
                if (!scriptSnapshotCache[fileName]) {
                    scriptSnapshotCache[fileName] = ScriptSnapshot.fromString(
                        fs_sync.staticFile(fileName)
                    );
                }
                return scriptSnapshotCache[fileName];
            } else if (fileName.startsWith("node_modules")) {
                const modulePath = fileName.slice("node_modules/".length);
                const { name, version, path } = parsePackageName(modulePath);

                if (version !== null) {
                    fileName = "node_modules/" + name + "/" + path;
                }

                if (!scriptSnapshotCache[fileName]) {
                    const packageVersion =
                        version || packagesVersions?.get(name);

                    scriptSnapshotCache[fileName] = ScriptSnapshot.fromString(
                        fs_sync.readFile(
                            "node_modules/" +
                                name +
                                "/" +
                                packageVersion +
                                "/" +
                                path
                        )
                    );
                }

                return scriptSnapshotCache[fileName];
            }

            makeSureSourceFilesAreLoaded();

            if (!sourceFiles[fileName]) {
                return null;
            }

            if (sourceFiles[fileName].contents === null) {
                sourceFiles[fileName].contents = fs_sync.readFile(fileName);
            }

            return ScriptSnapshot.fromString(sourceFiles[fileName].contents);
        },
        getCurrentDirectory: function () {
            // console.log("getCurrentDirectory");
            return "";
        },
        getDefaultLibFileName: function (options: CompilerOptions) {
            // console.log("getDefaultLibFileName");
            return "tsLib/lib.d.ts";
        },
        readFile: function (fileName: string) {
            // console.log("readFile", path);
            if (fileName.startsWith("node_modules")) {
                const modulePath = fileName.slice("node_modules/".length);
                const { name, version, path } = parsePackageName(modulePath);

                if (version !== null) {
                    fileName = "node_modules/" + name + "/" + path;
                }

                if (!scriptSnapshotCache[fileName]) {
                    const packageVersion =
                        version || packagesVersions?.get(name);

                    scriptSnapshotCache[fileName] = ScriptSnapshot.fromString(
                        fs_sync.readFile(
                            "node_modules/" +
                                name +
                                "/" +
                                packageVersion +
                                "/" +
                                path
                        )
                    );
                }

                return scriptSnapshotCache[fileName].getText(
                    0,
                    scriptSnapshotCache[fileName].getLength()
                );
            }

            makeSureSourceFilesAreLoaded();

            if (!sourceFiles[fileName]) {
                return null;
            }

            if (sourceFiles[fileName].contents === null) {
                sourceFiles[fileName].contents = fs_sync.readFile(fileName);
            }

            return sourceFiles[fileName].contents;
        },
        fileExists: function (fileName: string) {
            // console.log("fileExists", path);
            makeSureSourceFilesAreLoaded();

            if (fileName.startsWith("node_modules")) {
                const modulePath = fileName.slice("node_modules/".length);
                const { name, version } = parsePackageName(modulePath);

                if (version !== null) {
                    fileName = "node_modules/" + name + "/" + version;
                }

                const packageVersion = version || packagesVersions?.get(name);

                let moduleFiles = nodeModules.get(name);

                if (!moduleFiles) {
                    try {
                        moduleFiles = fs_sync
                            .readdir(
                                "node_modules/" + name + "/" + packageVersion
                            )
                            .map(
                                (file) =>
                                    "node_modules/" +
                                    name +
                                    (file ? "/" + file : "")
                            );
                    } catch (e) {
                        moduleFiles = [];
                    }

                    nodeModules.set(name, moduleFiles);
                }

                return moduleFiles.includes(fileName);
            }

            return Object.keys(sourceFiles).includes(fileName);
        }
    };
}

self.postMessage({ ready: true });
