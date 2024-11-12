import { EditorView, keymap } from "@codemirror/view";
import { createElement, ElementComponent } from "../../components/element";
import { createRefresheable } from "../../components/refresheable";
import { Store } from "../../store";
import { ipcEditor } from "../../store/ipc";
import prettyBytes from "pretty-bytes";
import { oneDark } from "@codemirror/theme-one-dark";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";

export function CodeEditor() {
    const container = createElement("div");
    const refresheable = createRefresheable(focusFile);
    Store.editor.codeEditor.focusedFile.subscribe(refresheable.refresh);
    container.ondestroy = () => {
        Store.editor.codeEditor.focusedFile.unsubscribe(refresheable.refresh);
    };
    container.append(refresheable.element);
    return container;
}

type View = {
    element: ElementComponent;
    editorView?: EditorView;
};

const views = new Map<string, View>();

function focusFile(path: string) {
    if (!path) return createElement("div");

    let view = views.get(path);

    if (!view) {
        view = createView(path);
        views.set(path, view);
    }

    return view.element;
}

function createView(filePath: string): View {
    const fileExtension = filePath.split(".").pop().toLowerCase();
    if (Object.values(BINARY_Ext).find((ext) => ext === fileExtension)) {
        return createBinaryView(filePath);
    } else if (Object.values(IMAGE_Ext).find((ext) => ext === fileExtension)) {
        return createImageView(filePath);
    }

    return createViewEditor(filePath);
}

function createBinaryView(filePath: string) {
    const container = createElement("div");
    container.classList.add("binary-view");

    ipcEditor.fs
        .stat(filePath)
        .then((stats) => (container.innerText = prettyBytes(stats.size)));

    return { element: container };
}

function createImageView(filePath: string) {
    const container = createElement("div");
    container.classList.add("image-view");
    const img = document.createElement("img");
    container.append(img);

    let imageURL: string;

    container.ondestroy = () => {
        URL.revokeObjectURL(imageURL);
    };

    ipcEditor.fs.readFile(filePath).then((imageData) => {
        const blob = new Blob([imageData]);
        imageURL = URL.createObjectURL(blob);
        img.src = imageURL;
    });

    return { element: container };
}

const defaultExtensions = [
    basicSetup,
    oneDark,
    keymap.of([indentWithTab]),
    indentUnit.of("    ")
];

function createViewEditor(filePath: string) {
    const container = createElement("div");

    const view: View = {
        element: container,
        editorView: null
    };

    ipcEditor.fs.readFile(filePath, { encoding: "utf8" }).then((content) => {
        view.editorView = new EditorView({
            doc: content,
            extensions: defaultExtensions,
            parent: container
        });
    });

    return view;
}

export function find<T>(
    set: Set<T> | MapIterator<T>,
    predicate: (item: T) => boolean
) {
    for (const item of set) {
        if (predicate(item)) return item;
    }
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

enum BINARY_Ext {
    ZIP = "zip"
}

const javascriptExtensions = [
    UTF8_Ext.JAVASCRIPT,
    UTF8_Ext.JAVASCRIPT_C,
    UTF8_Ext.JAVASCRIPT_M,
    UTF8_Ext.JAVASCRIPT_X
];

const typescriptExtensions = [UTF8_Ext.TYPESCRIPT, UTF8_Ext.TYPESCRIPT_X];

const jsTsExtensions = [...javascriptExtensions, ...typescriptExtensions];

export type FileError = {
    line: number;
    col: number;
    length: number;
    message: string;
};
