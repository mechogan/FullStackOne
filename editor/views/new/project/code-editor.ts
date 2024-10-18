import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, hoverTooltip, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { linter, lintGutter, Diagnostic } from "@codemirror/lint";
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

class CodeEditorClass {
    workingDirectory: string;
    parent: HTMLElement;
    activeFiles: {
        path: string;
        view?: CodeView;
    }[] = [];
    openedFilePath: string;
    onActiveFileChange: () => void;

    remove(path: string, forDeletion = false) {
        const index = this.activeFiles.findIndex((file) => file.path === path);
        if (index === -1) return;

        const [removed] = this.activeFiles.splice(index, 1);
        if (removed?.view?.saveThrottler) {
            clearTimeout(removed?.view?.saveThrottler);
        }
        if (!forDeletion) {
            removed?.view?.save();
        }
        removed?.view?.destroy();
        removed?.view?.dom?.remove();

        if (this.openedFilePath === removed?.path) this.openedFilePath = null;

        this.onActiveFileChange?.();
    }

    async reloadActiveFilesContent() {
        const filesToRemove: string[] = [];

        const reloadPromises = this.activeFiles.map(
            (file) =>
                new Promise<void>(async (resolve) => {
                    if (file.view.saveThrottler)
                        clearTimeout(file.view.saveThrottler);

                    const exists = await rpc().fs.exists(file.path, {
                        absolutePath: true
                    });
                    if (!exists) {
                        filesToRemove.push(file.path);
                        return resolve();
                    }

                    await file.view.load();
                    resolve();
                })
        );

        await Promise.all(reloadPromises);

        filesToRemove.forEach(this.remove.bind(this));

        this.onActiveFileChange?.();
    }

    saveAllActiveFiles() {
        const savePromises = this.activeFiles.map((file) => {
            if (file.view?.saveThrottler)
                clearTimeout(file.view?.saveThrottler);
            return file.view?.save();
        });
        return Promise.all(savePromises);
    }

    replacePath(oldPath: string, newPath: string) {
        const file = this.activeFiles.find(({ path }) => path === oldPath);
        if (!file) return;

        file.path = newPath;
        file.view.path = newPath;

        if (this.openedFilePath === oldPath) this.openedFilePath = newPath;

        this.onActiveFileChange?.();
    }

    private open(path: string) {
        this.openedFilePath = path;
        this.onActiveFileChange?.();
        this.clearParent();
        this.parent.append(
            this.activeFiles.find((file) => file.path === path).view.dom
        );
    }

    private clearParent() {
        Array.from(this.parent.children).forEach((child) => child.remove());
    }

    addFile(path: string) {
        if (this.activeFiles.find((file) => file.path === path)) {
            this.open(path);
            return;
        }

        const activeFile: CodeEditorClass["activeFiles"][0] = { path };
        this.activeFiles.push(activeFile);
        this.openedFilePath = path;
        this.onActiveFileChange?.();

        this.clearParent();

        createView(path).then((editorView) => {
            activeFile.view = editorView;
            this.open(path);
        });
    }

    setParent(workingDirectory: string, parent: HTMLElement) {
        this.workingDirectory = workingDirectory;
        this.parent = parent;
        this.activeFiles.forEach(({ view }) => view.destroy());
        this.activeFiles = [];
    }
}

export const CodeEditor = new CodeEditorClass();

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
    await WorkerTS.start(CodeEditor.workingDirectory);

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

const jsTsExtensions = [...javascriptExtensions, ...typescriptExtensions];
