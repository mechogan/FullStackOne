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
import { fsSync } from "../store/ipc/fsSync"

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
        const data = removeSourceObjects(method(...args));
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
    lib: ["lib.dom.d.ts", "lib.es2023.d.ts", "fullstacked.d.ts"],
    jsx: JsxEmit.React
};
let services: LanguageService;

export let methods = {
    version() {
        return version;
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
    ...services
};

let workingDirectory: string;
let sourceFiles: {
    [filename: string]: {
        contents: string;
        version: number;
    };
} = null;
const makeSureSourceFilesAreLoaded = () => {
    if (sourceFiles !== null) return;

    if (!workingDirectory) {
        throw new Error(
            "Trying to load source files before having set working directory."
        );
    }

    const files = fsSync.readdir(workingDirectory)
        .map((filename) => workingDirectory + "/" + filename);

    sourceFiles = {};

    files.forEach((file) => {
        sourceFiles[file] = {
            contents: null,
            version: 0,
        };
    });
};

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
                        fsSync.staticFile(fileName)
                    );
                }
                return scriptSnapshotCache[fileName];
            } else if (fileName.startsWith("node_modules")) {
                if (!scriptSnapshotCache[fileName]) {
                    scriptSnapshotCache[fileName] = ScriptSnapshot.fromString(
                        fsSync.readFile(fileName)
                    );
                }
                return scriptSnapshotCache[fileName];
            }

            makeSureSourceFilesAreLoaded();

            if (!sourceFiles[fileName]) {
                return null;
            }

            if (sourceFiles[fileName].contents === null) {
                sourceFiles[fileName].contents = fsSync.readFile(fileName);
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
        readFile: function (path: string) {
            // console.log("readFile", path);
            if (path.startsWith("node_modules")) {
                if (!scriptSnapshotCache[path]) {
                    scriptSnapshotCache[path] = ScriptSnapshot.fromString(
                        fsSync.readFile(path)
                    );
                }

                return scriptSnapshotCache[path].getText(
                    0,
                    scriptSnapshotCache[path].getLength()
                );
            }

            makeSureSourceFilesAreLoaded();

            if (!sourceFiles[path]) {
                return null;
            }

            if (sourceFiles[path].contents === null) {
                sourceFiles[path].contents = fsSync.readFile(path);
            }

            return sourceFiles[path].contents;
        },
        fileExists: function (path: string) {
            // console.log("fileExists", path);

            if (path.startsWith("node_modules")) {
                const pathComponents = path.split("/");
                const moduleName = pathComponents.at(1).startsWith("@")
                    ? pathComponents.at(1) + "/" + pathComponents.at(2)
                    : pathComponents.at(1);

                let moduleFiles = nodeModules.get(moduleName);

                if (!moduleFiles) {
                    try {
                        moduleFiles = fsSync.readdir("node_modules/" + moduleName)
                            .map((file) => "node_modules/" + moduleName + "/" + file);
                    } catch (e) {
                        moduleFiles = [];
                    }

                    nodeModules.set(moduleName, moduleFiles);
                }

                return moduleFiles.includes(path);
            }

            makeSureSourceFilesAreLoaded();

            return Object.keys(sourceFiles).includes(path);
        }
    };
}

self.postMessage({ ready: true });
