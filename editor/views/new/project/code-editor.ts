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

class CodeEditorClass {
    workingDirectory: string;
    parent: HTMLElement;
    activeFiles: {
        path: string;
        view?: (EditorView | ImageView) & {
            save: () => void;
        };
    }[] = [];
    openedFilePath: string;
    onActiveFileChange: () => void;

    remove(path: string) {
        const index = this.activeFiles.findIndex((file) => file.path === path);
        const [removed] = this.activeFiles.splice(index, 1);
        removed?.view?.save();
        removed?.view?.destroy();
        removed?.view?.dom?.remove();
        this.onActiveFileChange?.();
    }

    open(path: string) {
        this.openedFilePath = path;
        this.onActiveFileChange?.();
        this.clearParent();
        this.parent.append(
            this.activeFiles.find((file) => file.path === path).view.dom
        );
    }

    clearParent() {
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
        createView(path).then((editorView) => (activeFile.view = editorView));
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

function createView(
    filePath: string
): Promise<(ImageView | EditorView) & { save: () => void }> {
    const fileExtension = filePath.split(".").pop().toLowerCase();
    if (Object.values(IMAGE_Ext).find((ext) => ext === fileExtension)) {
        return createImageView(filePath);
    }

    return createViewEditor(filePath);
}

async function createViewEditor(filePath: string) {
    const saveFile = () => {
        const text = editorView.state.doc.toString();
        const fileExtension = filePath
            .split(".")
            .pop()
            .toLowerCase() as UTF8_Ext;

        if (typescriptExtensions.includes(fileExtension)) {
            return WorkerTS.call().updateFile(filePath, text, true);
        }

        rpc()
            .fs.exists(filePath)
            .then((exists) => {
                if (!exists?.isFile) return;

                rpc().fs.writeFile(filePath, text, {
                    absolutePath: true
                });
            });
    };

    let updateThrottler: ReturnType<typeof setTimeout>;
    const saveOnUpdate = () => {
        if (updateThrottler) clearTimeout(updateThrottler);
        updateThrottler = setTimeout(() => {
            saveFile();
            updateThrottler = null;
        }, 2000);
    };

    const doc = (await rpc().fs.readFile(filePath, {
        absolutePath: true,
        encoding: "utf8"
    })) as string;

    const editorView = new EditorView({
        doc,
        extensions: [
            ...defaultExtensions,
            ...(await languageExtensions(filePath)),
            EditorView.updateListener.of(saveOnUpdate)
        ],
        parent: CodeEditor.parent
    }) as EditorView & { save: () => void };

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
            return [langJSON.json(), langJSON.jsonParseLinter()];
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
    const imageData = await rpc().fs.readFile(filePath, {
        absolutePath: true
    });
    const imageBlob = new Blob([imageData]);
    img.src = window.URL.createObjectURL(imageBlob);
    CodeEditor.parent.append(img);
    return {
        destroy: () => window.URL.revokeObjectURL(img.src),
        save: () => {},
        dom: img
    };
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
