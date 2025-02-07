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
import { parseModuleName } from "./utils";
import fs_sync from "../lib/fs_sync";

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
        tsLib: { [path: string]: Uint8Array }
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
    },
    start(currentDirectory: string) {
        if (services) return;

        workingDirectory = currentDirectory;
        workingDirectoryNodeModules = currentDirectory + "/node_modules";

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
    updateFile(fileName: string, contents: string) {
        makeSureSourceFilesAreLoaded();

        if(fileName.startsWith(workingDirectoryNodeModules)) {
            scriptSnapshotCache[fileName] = ScriptSnapshot.fromString(contents)
            return;
        }

        sourceFiles[fileName] = {
            contents,
            version: sourceFiles?.[fileName]?.version
                ? sourceFiles?.[fileName]?.version + 1
                : 1
        };
    },

    ...services
};

// the root dir of our project
let workingDirectory: string;
let workingDirectoryNodeModules: string;

// all files in prooject dir 
// EXCEPT node_modules directory
let sourceFiles: {
    [filename: string]: {
        contents: string;
        version: number;
    };
} = null;

// all node_modules directories with there containing files
let nodeModules: Map<string, string[]> = new Map();

// cache scripts
const scriptSnapshotCache: {
    [path: string]: IScriptSnapshot;
} = {};

function makeSureSourceFilesAreLoaded() {
    if (sourceFiles !== null) return;

    if (!workingDirectory) {
        throw new Error(
            "Trying to load source files before having set working directory."
        );
    }

    const files = fs_sync
        .readdir(workingDirectory, ["node_modules", ".build", "data", ".git"])
        .map((filename) => workingDirectory + "/" + filename);

    sourceFiles = {};

    files.forEach((file) => {
        sourceFiles[file] = {
            contents: null,
            version: 0
        };
    });
}

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
                fileName.startsWith(workingDirectoryNodeModules)
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
            } else if (fileName.startsWith(workingDirectoryNodeModules)) {
                if (!scriptSnapshotCache[fileName]) {
                    scriptSnapshotCache[fileName] = ScriptSnapshot.fromString(
                        fs_sync.readFile(fileName)
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
            // console.log("readFile", fileName);
            if (fileName.startsWith("tsLib")) {
                if (!scriptSnapshotCache[fileName]) {
                    scriptSnapshotCache[fileName] = ScriptSnapshot.fromString(
                        fs_sync.staticFile(fileName)
                    );
                }

                return scriptSnapshotCache[fileName].getText(
                    0,
                    scriptSnapshotCache[fileName].getLength()
                );
            } else if (fileName.startsWith(workingDirectoryNodeModules)) {
                if (!scriptSnapshotCache[fileName]) {
                    scriptSnapshotCache[fileName] = ScriptSnapshot.fromString(
                        fs_sync.readFile(fileName)
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
            // console.log("fileExists", fileName)

            makeSureSourceFilesAreLoaded();

            if (fileName.startsWith(workingDirectoryNodeModules)) {
                const { name, path } = parseModuleName(fileName.slice(workingDirectoryNodeModules.length + 1))

                let contents = nodeModules.get(name);
                if (!contents) {
                    try {
                        contents = fs_sync.readdir(workingDirectoryNodeModules + "/" + name, []);
                        nodeModules.set(name, contents)
                    } catch(e) {
                        return false
                    }
                }

                return contents.includes(path)
            }

            return Object.keys(sourceFiles).includes(fileName);
        }
    };
}

self.postMessage({ ready: true });
