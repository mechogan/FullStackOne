import { EditorView, hoverTooltip, keymap } from "@codemirror/view";
import { createElement, ElementComponent } from "../../components/element";
import { createRefresheable } from "../../components/refresheable";
import { Store } from "../../store";
import { ipcEditor } from "../../ipc";
import prettyBytes from "pretty-bytes";
import { oneDark } from "@codemirror/theme-one-dark";
import { basicSetup } from "codemirror";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import {
    Diagnostic,
    linter,
    lintGutter,
    setDiagnostics
} from "@codemirror/lint";
import prettier from "prettier";
import prettierPluginHTML from "prettier/plugins/html";
import prettierPluginCSS from "prettier/plugins/postcss";
import prettierPluginMD from "prettier/plugins/markdown";
import prettierPluginEstree from "prettier/plugins/estree";
import prettierPluginTypeScript from "prettier/plugins/typescript";
import { EditorSelection } from "@codemirror/state";
import { WorkerTS } from "../../typescript";
import {
    tsAutocomplete,
    tsErrorLinter,
    tsTypeDefinition
} from "./ts-extensions";
import { Project } from "../../types";
import { autocompletion } from "@codemirror/autocomplete";
import { BuildError } from "../../store/editor";

const tabWidth = 4;
window.addEventListener("keydown", applyPrettierToCurrentFocusFile);

let workingDirectory: string,
    buildErrors: BuildError[] = [];
export function CodeEditor(project: Project) {
    workingDirectory = project.id;

    const container = createElement("div");

    const onBuildErrors = (errors: BuildError[]) => {
        clearBuildErrors();
        1;
        buildErrors = errors.filter(({ file }) => file.startsWith(project.id));
        buildErrors.forEach((err) => {
            Store.editor.codeEditor.openFile(err.file);
            Store.editor.codeEditor.focusFile(err.file);
        });
    };

    const refresheable = createRefresheable(focusFile);
    Store.editor.codeEditor.focusedFile.subscribe(refresheable.refresh);
    Store.editor.codeEditor.openedFiles.subscribe(createViews);
    Store.editor.codeEditor.buildErrors.subscribe(onBuildErrors);

    container.ondestroy = () => {
        Store.editor.codeEditor.openedFiles.unsubscribe(createViews);
        Store.editor.codeEditor.focusedFile.unsubscribe(refresheable.refresh);
        Store.editor.codeEditor.buildErrors.unsubscribe(onBuildErrors);
    };
    container.append(refresheable.element);
    return container;
}

type View = {
    element: ElementComponent;
    editorView?: EditorView & { save: (throttled?: boolean) => Promise<void> };
};

const views = new Map<string, View>();

export async function saveAllViews() {
    await Promise.all(
        Array.from(views.values())
            .filter((v) => v.editorView)
            .map((v) => v.editorView.save(false))
    );
    console.log("all saved");
}

function createViews(filesPaths: Set<string>) {
    const pathToClose = new Set<string>();
    for (const path of views.keys()) {
        if (filesPaths.has(path)) continue;
        pathToClose.add(path);
    }
    pathToClose.forEach((path) => {
        const view = views.get(path);
        view.editorView?.save(false).then(() => view.editorView?.destroy());
        views.delete(path);
        if (focusedViewPath === path) {
            Store.editor.codeEditor.focusFile(null);
        }
    });
    filesPaths.forEach((path) => {
        if (views.get(path)) return;
        focusFile(path);
    });
}

let focusedViewPath: string;
function focusFile(path: string) {
    focusedViewPath = path;

    if (!path) return createElement("div");

    let view = views.get(path);

    if (!view) {
        view = createView(path);
        views.set(path, view);
    } else {
        displayBuildErrors(path, view);
    }

    return view.element;
}

function displayBuildErrors(path: string, view: View) {
    if (!view.editorView) return;

    const errors = buildErrors.filter(({ file }) => file === path);

    if (errors.length === 0) return;

    const diagnostics: Diagnostic[] = errors.map((fileError) => {
        const from =
            view.editorView.state.doc.line(fileError.line).from + fileError.col;
        return {
            from,
            to: from + fileError.length,
            severity: "error",
            message: fileError.message
        };
    });

    view.editorView.dispatch(
        setDiagnostics(view.editorView.state, diagnostics)
    );
}

function clearBuildErrors() {
    for (const view of views.values()) {
        view.editorView?.dispatch(setDiagnostics(view.editorView?.state, []));
    }
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
    indentUnit.of(new Array(tabWidth + 1).join(" "))
];

function createViewEditor(filePath: string) {
    const container = createElement("div");

    const view: View = {
        element: container,
        editorView: null
    };

    ipcEditor.fs
        .readFile(filePath, { encoding: "utf8" })
        .then(async (content) => {
            view.editorView = new EditorView({
                doc: content,
                extensions: [
                    ...defaultExtensions,
                    ...(await languageExtensions(filePath)),
                    EditorView.updateListener.of(() => view.editorView.save())
                ],
                parent: container
            }) as any;

            let throttler: ReturnType<typeof setTimeout>;
            view.editorView.save = (throttled = true) => {
                if (throttler) {
                    clearTimeout(throttler);
                }

                const saveFile = async () => {
                    throttler = null;
                    const exists = await ipcEditor.fs.exists(filePath);
                    if (!exists?.isFile) return;
                    await ipcEditor.fs.writeFile(
                        filePath,
                        view.editorView.state.doc.toString()
                    );
                };

                if (throttled) {
                    throttler = setTimeout(saveFile, 2000);
                } else {
                    return saveFile();
                }
            };

            displayBuildErrors(filePath, view);
        });

    return view;
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
        case UTF8_Ext.SVG:
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
        EditorView.updateListener.of((ctx) =>
            WorkerTS.call().updateFile(filePath, ctx.state.doc.toString())
        ),
        linter(tsErrorLinter(filePath) as () => Promise<Diagnostic[]>),
        autocompletion({ override: [tsAutocomplete(filePath)] }),
        hoverTooltip(tsTypeDefinition(filePath))
    ];
}

const prettierPlugins = [
    prettierPluginHTML,
    prettierPluginCSS,
    prettierPluginMD,
    prettierPluginEstree,
    prettierPluginTypeScript
];

async function applyPrettierToCurrentFocusFile(e: KeyboardEvent) {
    if (e.key !== "s" || (!e.metaKey && !e.ctrlKey)) return;

    e.preventDefault();

    const view = views.get(focusedViewPath);
    if (!view?.editorView) return;

    const fileExtension = focusedViewPath
        .split(".")
        .pop()
        .toLowerCase() as UTF8_Ext;
    if (!prettierSupport.includes(fileExtension)) return;

    let filepath = focusedViewPath;
    if (fileExtension === UTF8_Ext.SVG) {
        filepath = filepath.slice(0, 0 - ".svg".length) + ".html";
    }

    const formatted = await prettier.format(
        view.editorView.state.doc.toString(),
        {
            filepath,
            plugins: prettierPlugins,
            tabWidth
        }
    );

    let selection = view.editorView.state.selection;

    let range = selection.ranges?.at(0);
    if (range?.from > formatted.length) {
        selection = selection.replaceRange(
            EditorSelection.range(formatted.length, range.to),
            0
        );
        range = selection.ranges?.at(0);
    }
    if (range?.to > formatted.length) {
        selection = selection.replaceRange(
            EditorSelection.range(range.from, formatted.length),
            0
        );
    }

    view.editorView.dispatch({
        changes: {
            from: 0,
            to: view.editorView.state.doc.length,
            insert: formatted
        },
        selection
    });
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

const prettierSupport = [
    ...jsTsExtensions,
    UTF8_Ext.HTML,
    UTF8_Ext.SVG,
    UTF8_Ext.JSON,
    UTF8_Ext.MARKDOWN,
    UTF8_Ext.CSS,
    UTF8_Ext.SASS,
    UTF8_Ext.SCSS
];

export type FileError = {
    line: number;
    col: number;
    length: number;
    message: string;
};
