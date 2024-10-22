import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, hoverTooltip, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import {
    linter,
    lintGutter,
    Diagnostic,
    setDiagnostics
} from "@codemirror/lint";
import rpc from "../../../rpc";
import { WorkerTS } from "../../../typescript";
import {
    tsAutocomplete,
    tsErrorLinter,
    tsTypeDefinition
} from "./ts-extensions";
import { autocompletion } from "@codemirror/autocomplete";

type ImageView = {
    dom: HTMLElement;
    destroy: () => void;
};

type CodeViewExtension = {
    path: string;
    load: () => Promise<void>;
    save: () => Promise<void>;
    saveThrottler?: ReturnType<typeof setTimeout>;
};

type CodeView = (EditorView | ImageView) & CodeViewExtension;

export type FileError = {
    line: number;
    col: number;
    length: number;
    message: string;
};

type ActiveFile = {
    path: string;
    view?: CodeView;
};

type setParentOpts = {
    workingDirectory: string;
    element: HTMLElement;
};

let workingDirectory: string;
let parentElement: HTMLElement;

export const CodeEditor = {
    activeFiles: new Set<ActiveFile>(),
    openedFilePath: null as string,
    set parent(opts: setParentOpts) {
        workingDirectory = opts.workingDirectory;
        parentElement = opts.element;
        CodeEditor.activeFiles.forEach(({ view }) => view.destroy());
        CodeEditor.activeFiles.clear();
    },
    onActiveFileChange: null as () => void,
    addFile,
    replacePath,
    remove,
    reloadActiveFilesContent,
    saveAllActiveFiles,
    addBuildFileErrors,
    clearAllErrors
};

function find<T>(set: Set<T>, predicate: (item: T) => boolean) {
    for (const item of set) {
        if (predicate(item)) return item;
    }
}

async function addFile(path: string) {
    const alreadyActiveFile = find(
        CodeEditor.activeFiles,
        (file) => file.path === path
    );
    if (alreadyActiveFile) {
        open(path);
        return alreadyActiveFile;
    }

    const activeFile: ActiveFile = { path };
    CodeEditor.activeFiles.add(activeFile);
    CodeEditor.openedFilePath = path;
    CodeEditor.onActiveFileChange?.();

    clearParent();

    activeFile.view = await createView(path);
    open(path);
    return activeFile;
}

function open(path: string) {
    CodeEditor.openedFilePath = path;
    CodeEditor.onActiveFileChange?.();
    clearParent();
    parentElement.append(
        find(CodeEditor.activeFiles, (file) => file.path === path).view.dom
    );
}

function replacePath(oldPath: string, newPath: string) {
    const file = find(CodeEditor.activeFiles, ({ path }) => path === oldPath);
    if (!file) return;

    file.path = newPath;
    file.view.path = newPath;

    if (CodeEditor.openedFilePath === oldPath) {
        CodeEditor.openedFilePath = newPath;
    }

    CodeEditor.onActiveFileChange?.();
}

async function reloadActiveFilesContent() {
    const filesToRemove = new Set<string>();
    const reloadPromises: Promise<any>[] = [];

    const deleteOrRemove = async (file: ActiveFile) => {
        if (file.view.saveThrottler) clearTimeout(file.view.saveThrottler);

        const exists = await rpc().fs.exists(file.path, {
            absolutePath: true
        });
        if (!exists) {
            filesToRemove.add(file.path);
        } else {
            return file.view.load();
        }
    };

    CodeEditor.activeFiles.forEach((file) =>
        reloadPromises.push(deleteOrRemove(file))
    );

    await Promise.all(reloadPromises);

    filesToRemove.forEach((file) => remove(file));

    CodeEditor.onActiveFileChange?.();
}

function saveAllActiveFiles() {
    const savePromises = [];
    CodeEditor.activeFiles.forEach((file) => {
        if (file.view?.saveThrottler) clearTimeout(file.view?.saveThrottler);
        savePromises.push(file.view?.save());
    });
    return Promise.all(savePromises);
}

function remove(path: string, forDeletion = false) {
    const activeFile = find(
        CodeEditor.activeFiles,
        (file) => file.path === path
    );
    if (!activeFile) return;

    if (activeFile.view?.saveThrottler) {
        clearTimeout(activeFile.view?.saveThrottler);
    }
    if (!forDeletion) {
        activeFile.view?.save();
    }
    activeFile.view?.destroy();
    activeFile.view?.dom?.remove();

    if (this.openedFilePath === activeFile.path) this.openedFilePath = null;

    CodeEditor.activeFiles.delete(activeFile);

    CodeEditor.onActiveFileChange?.();
}

function clearParent() {
    for (const child of parentElement.children) {
        child.remove();
    }
}

const defaultExtensions = [
    basicSetup,
    oneDark,
    keymap.of([indentWithTab]),
    indentUnit.of("    ")
];

function createView(filePath: string): Promise<CodeView> {
    const fileExtension = filePath.split(".").pop().toLowerCase();
    if (Object.values(IMAGE_Ext).find((ext) => ext === fileExtension)) {
        return createImageView(filePath);
    }

    return createViewEditor(filePath);
}

async function createViewEditor(filePath: string) {
    const saveOnUpdate = () => {
        if (editorView.saveThrottler) clearTimeout(editorView.saveThrottler);
        editorView.saveThrottler = setTimeout(() => {
            saveFile();
            editorView.saveThrottler = null;
        }, 2000);
    };

    const loadContentFromFile = (path: string) => {
        return rpc().fs.readFile(path, {
            absolutePath: true,
            encoding: "utf8"
        }) as Promise<string>;
    };

    const editorView = new EditorView({
        doc: await loadContentFromFile(filePath),
        extensions: [
            ...defaultExtensions,
            ...(await languageExtensions(filePath)),
            EditorView.updateListener.of(saveOnUpdate)
        ]
    }) as EditorView & CodeViewExtension;

    editorView.path = filePath;

    editorView.load = async () => {
        editorView.dispatch({
            changes: {
                from: 0,
                to: editorView.state.doc.length,
                insert: await loadContentFromFile(editorView.path)
            }
        });
    };

    const saveFile = async () => {
        const text = editorView.state.doc.toString();
        const fileExtension = editorView.path
            .split(".")
            .pop()
            .toLowerCase() as UTF8_Ext;

        if (typescriptExtensions.includes(fileExtension)) {
            return WorkerTS.call().updateFile(editorView.path, text, true);
        }

        const exists = await rpc().fs.exists(editorView.path, {
            absolutePath: true
        });
        if (!exists?.isFile) return;

        return rpc().fs.writeFile(editorView.path, text, {
            absolutePath: true
        });
    };

    editorView.save = saveFile;

    return editorView;
}

async function languageExtensions(filePath: string) {
    const fileExtension = filePath.split(".").pop().toLowerCase() as UTF8_Ext;

    switch (fileExtension) {
        case UTF8_Ext.JAVASCRIPT:
        case UTF8_Ext.JAVASCRIPT_C:
        case UTF8_Ext.JAVASCRIPT_M:
        case UTF8_Ext.JAVASCRIPT_X:
        case UTF8_Ext.TYPESCRIPT:
        case UTF8_Ext.TYPESCRIPT_X:
            return loadJsTsExtensions(filePath);
        case UTF8_Ext.HTML:
            const langHTML = await import("@codemirror/lang-html");
            return [langHTML.html()];
        case UTF8_Ext.MARKDOWN:
            const langMD = await import("@codemirror/lang-markdown");
            return [langMD.markdown()];
        case UTF8_Ext.JSON:
            const langJSON = await import("@codemirror/lang-json");
            return [langJSON.json(), linter(langJSON.jsonParseLinter())];
        case UTF8_Ext.CSS:
            const langCSS = await import("@codemirror/lang-css");
            return [langCSS.css()];
        case UTF8_Ext.SASS:
        case UTF8_Ext.SCSS:
            const langSASS = await import("@codemirror/lang-sass");
            return [
                langSASS.sass({
                    indented: fileExtension === UTF8_Ext.SASS
                })
            ];
        case UTF8_Ext.LIQUID:
            const langLiquid = await import("@codemirror/lang-liquid");
            return [langLiquid.liquid(), langLiquid.closePercentBrace];
    }

    return [];
}

async function loadJsTsExtensions(filePath: string) {
    const extensions = [];
    const fileExtension = filePath.split(".").pop().toLowerCase() as UTF8_Ext;
    const langJs = await import("@codemirror/lang-javascript");

    const jsDefaultExtension = langJs.javascript({
        typescript: typescriptExtensions.includes(fileExtension),
        jsx: fileExtension.endsWith("x")
    });

    extensions.push(jsDefaultExtension, lintGutter());

    if (javascriptExtensions.includes(fileExtension)) {
        const jsAutocomplete = langJs.javascriptLanguage.data.of({
            autocomplete: langJs.scopeCompletionSource(globalThis)
        });
        extensions.push(jsAutocomplete);
    }
    // load typescript
    else {
        extensions.push(...(await loadTypeScript(filePath)));
    }

    return extensions;
}

async function loadTypeScript(filePath: string) {
    await WorkerTS.start(workingDirectory);

    return [
        linter(tsErrorLinter(filePath) as () => Promise<Diagnostic[]>),
        autocompletion({ override: [tsAutocomplete(filePath)] }),
        hoverTooltip(tsTypeDefinition(filePath))
    ];
}

async function createImageView(filePath: string) {
    const img = document.createElement("img");

    const loadFromFile = async (path: string) => {
        const imageData = await rpc().fs.readFile(path, {
            absolutePath: true
        });
        const imageBlob = new Blob([imageData]);
        img.src = window.URL.createObjectURL(imageBlob);
    };

    const destroy = () => window.URL.revokeObjectURL(img.src);

    const imageView = {
        path: filePath,
        destroy,
        save: async () => {},
        load: async () => {
            destroy();
            loadFromFile(imageView.path);
        },
        dom: img
    };

    loadFromFile(filePath);

    return imageView;
}

enum UTF8_Ext {
    JAVASCRIPT = "js",
    JAVASCRIPT_X = "jsx",
    JAVASCRIPT_M = "mjs",
    JAVASCRIPT_C = "cjs",
    TYPESCRIPT = "ts",
    TYPESCRIPT_X = "tsx",
    SVG = "svg",
    TEXT = "txt",
    MARKDOWN = "md",
    YML = "yml",
    YAML = "yaml",
    HTML = "html",
    CSS = "css",
    JSON = "json",
    SASS = "sass",
    SCSS = "scss",
    LIQUID = "liquid"
}

enum IMAGE_Ext {
    PNG = "png",
    JPG = "jpg",
    JPEG = "jpeg",
    GIF = "gif",
    WEBP = "webp",
    BMP = "bmp"
}

const javascriptExtensions = [
    UTF8_Ext.JAVASCRIPT,
    UTF8_Ext.JAVASCRIPT_C,
    UTF8_Ext.JAVASCRIPT_M,
    UTF8_Ext.JAVASCRIPT_X
];

const typescriptExtensions = [UTF8_Ext.TYPESCRIPT, UTF8_Ext.TYPESCRIPT_X];

type addFileErrorsOpts = {
    path: string;
    errors: FileError[];
};

async function addBuildFileErrors(opts: addFileErrorsOpts) {
    const activeFile = await addFile(opts.path);
    const editorView = activeFile.view as EditorView;
    const diagnostics: Diagnostic[] = opts.errors.map((fileError) => {
        const from =
            editorView.state.doc.line(fileError.line).from + fileError.col;
        return {
            from,
            to: from + fileError.length,
            severity: "error",
            message: fileError.message
        };
    });
    editorView.dispatch(setDiagnostics(editorView.state, diagnostics));
}

function clearAllErrors() {
    for (const activeFile of CodeEditor.activeFiles) {
        const maybeEditorView = activeFile.view as EditorView;
        maybeEditorView?.dispatch?.(setDiagnostics(maybeEditorView.state, []));
    }
}
