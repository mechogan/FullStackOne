import { EditorView, hoverTooltip, keymap, ViewPlugin } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { createElement } from "../../components/element";
import { createRefresheable } from "../../components/refresheable";
import { Store } from "../../store";
import prettyBytes from "pretty-bytes";
import { oneDark } from "@codemirror/theme-one-dark";
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
import prettierPluginBabel from "prettier/plugins/babel";
import prettierPluginTypeScript from "prettier/plugins/typescript";
import { EditorSelection, Extension } from "@codemirror/state";
import { WorkerTS } from "../../typescript";
import {
    navigateToDefinition,
    tsAutocomplete,
    tsErrorLinter,
    tsTypeDefinition
} from "./ts-extensions";
import { Project } from "../../types";
import { autocompletion } from "@codemirror/autocomplete";
import { BuildError, editor } from "../../store/editor";
import fs from "../../../lib/fs";
import core_message from "../../../lib/core_message";
import { FileEvent, FileEventType } from "./file-event";

const tabWidth = 4;
window.addEventListener("keydown", applyPrettierToCurrentFocusFile);

let workingDirectory: string,
    buildErrors: BuildError[] = [];
export function CodeEditor(project: Project) {
    workingDirectory = project.id;

    const container = createElement("div");

    const onBuildErrors = (errors: BuildError[]) => {
        clearBuildErrors();
        buildErrors = errors.filter(({ file }) => file?.startsWith(project.id));
        buildErrors.forEach((err) => {
            Store.editor.codeEditor.openFile(err.file);
            Store.editor.codeEditor.focusFile(err.file);
        });
    };

    const refresheable = createRefresheable(focusFile);
    Store.editor.codeEditor.focusedFile.subscribe(refresheable.refresh);
    Store.editor.codeEditor.openedFiles.subscribe(createViews);
    Store.editor.codeEditor.buildErrors.subscribe(onBuildErrors);

    const updateCodeEditor = (eStr: string) => {
        const fileEvents = JSON.parse(eStr) as FileEvent[];
        for (const e of fileEvents) {
            if (e.type === FileEventType.MODIFIED) {
                if (e.origin !== "code-editor") {
                    const path =
                        project.id + e.paths.at(0)?.split(project.id).pop();
                    const view = views.get(path);
                    view?.editorView?.reload();
                }
            }
        }

        if (
            fileEvents.every(
                (e) =>
                    e.type === FileEventType.MODIFIED &&
                    e.origin === "code-editor"
            )
        ) {
            return;
        }

        for (const v of views.values()) {
            v.editorView?.lint?.();
        }
    };

    core_message.addListener("file-event", updateCodeEditor);

    container.ondestroy = () => {
        core_message.removeListener("file-event", updateCodeEditor);
        Store.editor.codeEditor.openedFiles.unsubscribe(createViews);
        Store.editor.codeEditor.focusedFile.unsubscribe(refresheable.refresh);
        Store.editor.codeEditor.buildErrors.unsubscribe(onBuildErrors);
    };
    container.append(refresheable.element);
    return container;
}

type View = ReturnType<typeof createRefresheable> & {
    editorView?: EditorView & {
        save: (throttled?: boolean) => Promise<void>;
        reload: () => Promise<void>;
        lint?: () => void;
    };
};

const views = new Map<string, View>();

export function saveAllViews() {
    return Promise.all(
        Array.from(views.values())
            .filter((v) => v.editorView)
            .map((v) => v.editorView.save(false))
    );
}

export function refreshCodeEditorView(filePath: string) {
    const view = views.get(filePath);
    if (!view) return;
    else if (view.editorView) {
        return view.editorView.reload();
    } else {
        return view.refresh();
    }
}

export function refreshAllCodeEditorView() {
    const promises = [];
    for (const filePath of views.keys()) {
        const maybePromise = refreshCodeEditorView(filePath);
        if (maybePromise) {
            promises.push(maybePromise);
        }
    }
    return Promise.all(promises);
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

    const container = createElement("div");

    if (!path) return container;

    let view = views.get(path);

    if (!view) {
        view = createView(path);
        view.refresh();
        views.set(path, view);
    } else {
        displayBuildErrors(path, view);
    }

    container.append(view.element);

    return container;
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
    const render = async () => {
        const container = createElement("div");
        container.classList.add("binary-view");

        const stats = await fs.stat(filePath);
        container.innerText = prettyBytes(stats.size);

        return container;
    };

    return createRefresheable(render);
}

function createImageView(filePath: string) {
    const render = async () => {
        const container = createElement("div");
        container.classList.add("image-view");
        const img = document.createElement("img");
        container.append(img);

        let imageURL: string;

        container.ondestroy = () => {
            URL.revokeObjectURL(imageURL);
        };

        const imageData = await fs.readFile(filePath);
        const blob = new Blob([imageData]);
        imageURL = URL.createObjectURL(blob);
        img.src = imageURL;

        return container;
    };

    return createRefresheable(render);
}

const defaultExtensions = [
    basicSetup,
    EditorView.clickAddsSelectionRange.of((e) => e.altKey && !e.metaKey),
    oneDark,
    keymap.of([indentWithTab]),
    indentUnit.of(new Array(tabWidth + 1).join(" "))
];

function createViewEditor(filePath: string) {
    let throttler: ReturnType<typeof setTimeout>, view: View;

    const render = async () => {
        if (throttler) {
            clearTimeout(throttler);
            throttler = null;
        }

        const container = createElement("div");

        const content = await fs.readFile(filePath, {
            encoding: "utf8"
        });

        const languageExtension = await languageExtensions(filePath);

        view.editorView = new EditorView({
            doc: content,
            extensions: [
                ...defaultExtensions,
                ...languageExtension.map(({ ext }) => ext),
                EditorView.updateListener.of(() => view.editorView.save())
            ],
            parent: container
        }) as any;

        view.editorView.save = (throttled = true) => {
            if (throttler) {
                clearTimeout(throttler);
            }

            const saveFile = async () => {
                throttler = null;
                const exists = await fs.exists(filePath);
                if (!exists?.isFile) return;
                await fs.writeFile(
                    filePath,
                    view.editorView.state.doc.toString(),
                    "code-editor"
                );
            };

            if (throttled) {
                throttler = setTimeout(saveFile, 1000);
            } else {
                return saveFile();
            }
        };
        view.editorView.reload = async () => {
            const exists = await fs.exists(filePath);
            if (!exists?.isFile) return;
            const content = await fs.readFile(filePath, { encoding: "utf8" });
            setFullContent(view.editorView, content);
        };

        const linter = languageExtension.find(({ type }) => type === "linter");

        if (linter) {
            view.editorView.lint = () => {
                const plugin = view.editorView.plugin(linter.ext[1]) as any;
                if (plugin) {
                    plugin.set = true;
                    plugin.force();
                }
            };
        }

        displayBuildErrors(filePath, view);

        return container;
    };

    view = createRefresheable(render);

    return view;
}

async function languageExtensions(filePath: string): Promise<
    {
        type?: string;
        ext: Extension;
    }[]
> {
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
            return [{ ext: langHTML.html() }];
        case UTF8_Ext.MARKDOWN:
            const langMD = await import("@codemirror/lang-markdown");
            return [{ ext: langMD.markdown() }];
        case UTF8_Ext.JSON:
            const langJSON = await import("@codemirror/lang-json");
            return [
                { ext: langJSON.json() },
                { ext: linter(langJSON.jsonParseLinter()) }
            ];
        case UTF8_Ext.CSS:
            const langCSS = await import("@codemirror/lang-css");
            return [{ ext: langCSS.css() }];
        case UTF8_Ext.SASS:
        case UTF8_Ext.SCSS:
            const langSASS = await import("@codemirror/lang-sass");
            return [
                {
                    ext: langSASS.sass({
                        indented: fileExtension === UTF8_Ext.SASS
                    })
                }
            ];
        case UTF8_Ext.LIQUID:
            const langLiquid = await import("@codemirror/lang-liquid");
            return [
                { ext: langLiquid.liquid() },
                { ext: langLiquid.closePercentBrace }
            ];
    }

    return [];
}

async function loadJsTsExtensions(filePath: string) {
    const extensions: {
        type?: string;
        ext: Extension;
    }[] = [];
    const fileExtension = filePath.split(".").pop().toLowerCase() as UTF8_Ext;

    const langJs = await import("@codemirror/lang-javascript");

    const jsDefaultExtension = langJs.javascript({
        typescript: typescriptExtensions.includes(fileExtension),
        jsx: fileExtension.endsWith("x")
    });

    extensions.push({ ext: jsDefaultExtension }, { ext: lintGutter() });

    if (javascriptExtensions.includes(fileExtension)) {
        const jsAutocomplete = langJs.javascriptLanguage.data.of({
            autocomplete: langJs.scopeCompletionSource(globalThis)
        });
        extensions.push({ ext: jsAutocomplete });
    }
    // load typescript
    else {
        extensions.push(...(await loadTypeScript(filePath)));
    }

    return extensions;
}

let lint;

async function loadTypeScript(filePath: string) {
    await WorkerTS.start(workingDirectory);

    return [
        {
            ext: EditorView.updateListener.of((ctx) =>
                WorkerTS.call().updateFile(filePath, ctx.state.doc.toString())
            )
        },
        {
            ext: EditorView.domEventHandlers({
                click: navigateToDefinition(filePath)
            })
        },
        {
            ext: linter(tsErrorLinter(filePath) as () => Promise<Diagnostic[]>),
            type: "linter"
        },
        { ext: autocompletion({ override: [tsAutocomplete(filePath)] }) },
        { ext: hoverTooltip(tsTypeDefinition(filePath)) }
    ];
}

const prettierPlugins = [
    prettierPluginHTML,
    prettierPluginCSS,
    prettierPluginMD,
    prettierPluginEstree,
    prettierPluginBabel,
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

    setFullContent(view.editorView, formatted);
}

function setFullContent(editorView: EditorView, content: string) {
    let selection = editorView.state.selection;

    let range = selection.ranges?.at(0);
    if (range?.from > content.length) {
        selection = selection.replaceRange(
            EditorSelection.range(content.length, range.to),
            0
        );
        range = selection.ranges?.at(0);
    }
    if (range?.to > content.length) {
        selection = selection.replaceRange(
            EditorSelection.range(range.from, content.length),
            0
        );
    }

    editorView.dispatch({
        changes: {
            from: 0,
            to: editorView.state.doc.length,
            insert: content
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
    ZIP = "zip",
    TGZ = ".tgz",
    WOFF2 = "woff2",
    WOFF = "woff"
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
