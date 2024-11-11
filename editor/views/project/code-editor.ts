import { EditorView } from "@codemirror/view";
import { createElement, ElementComponent } from "../../components/element";
import { createRefresheable } from "../../components/refresheable";
import { Store } from "../../store";
import { ipcEditor } from "../../store/ipc";
import prettyBytes from "pretty-bytes";

export function CodeEditor() {
    const container = createElement("div");
    const refresheable = createRefresheable(focusFile);
    Store.editor.codeEditor.focusedFile.subscribe(refresheable.refresh);
    container.ondestroy = () => {
        Store.editor.codeEditor.focusedFile.unsubscribe(refresheable.refresh);
    }
    container.append(refresheable.element);
    return container;
}

type GenericView = {
    path: string,
    dom: ElementComponent
}

type CodeView = GenericView | (EditorView & { path: string })

const views = new Set<CodeView>();

function focusFile(path: string) {
    let view = find(views, view => view.path === path);

    if(!view) {
        view = createView(path);
        views.add(view);
    }

    return view.dom as ElementComponent;
}

function createView(filePath: string): CodeView {
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

    const binaryView = {
        path: filePath,
        dom: container
    };

    const stats = ipcEditor.fs.stat(filePath);
    container.innerText = prettyBytes(stats.size);

    return binaryView;
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