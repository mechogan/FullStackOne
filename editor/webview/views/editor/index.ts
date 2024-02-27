import "./index.css";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { indentWithTab } from "@codemirror/commands";
import {
    linter,
    lintGutter,
    setDiagnostics,
    Diagnostic,
} from "@codemirror/lint";
import { Extension } from "@codemirror/state";

import type typeRPC from "../../../../src/webview";
import type api from "../../../api";

declare var rpc: typeof typeRPC<typeof api>;

enum UTF8_Ext {
    JAVASCRIPT = ".js",
    JAVASCRIPT_X = ".jsx",
    JAVASCRIPT_M = ".mjs",
    JAVASCRIPT_C = ".cjs",
    TYPESCRIPT = ".ts",
    TYPESCRIPT_X = ".tsx",
    SVG = ".svg",
    TEXT = ".txt",
    MARKDOWN = ".md",
    YML = ".yml",
    YAML = ".yaml",
    HTML = ".html",
    CSS = ".css",
    JSON = ".json",
    SASS = ".sass",
    SCSS = ".scss",
}

enum IMAGE_Ext {
    PNG = ".png",
    JPG = ".jpg",
    JPEG = ".jpeg",
    GIF = ".gif",
    WEBP = ".webp",
    BMP = ".bmp",
}

export class Editor {
    private extensions = [
        basicSetup,
        oneDark,
        keymap.of([indentWithTab]),
        EditorView.updateListener.of(this.updateFileContents.bind(this)),
    ];
    private parent = document.createElement("div");
    private editor: EditorView;
    private errors: {
        line: number;
        col: number;
        length: number;
        message: string;
    }[] = [];
    filePath: string[];

    constructor(filePath: string[]) {
        this.filePath = filePath;

        this.loadFileContents().then(() => this.esbuildErrorLint());
    }

    addBuildError(error: Editor["errors"][0]) {
        this.errors.push(error);
        this.esbuildErrorLint();
    }
    hasBuildErrors() {
        return this.errors.length > 0;
    }
    clearBuildErrors() {
        this.errors = [];
        this.esbuildErrorLint();
    }

    private esbuildErrorLint() {
        if (!this.editor) return;

        const diagnostics: Diagnostic[] = this.errors.map((error) => {
            const from =
                this.editor.state.doc.line(error.line).from + error.col;
            return {
                from,
                to: from + error.length,
                severity: "error",
                message: error.message,
            };
        });
        this.editor.dispatch(setDiagnostics(this.editor.state, diagnostics));
    }

    private async loadFileContents() {
        if (
            Object.values(UTF8_Ext).find((ext) =>
                this.filePath.at(-1)?.endsWith(ext),
            )
        ) {
            this.editor = new EditorView({
                doc: await rpc().fs.readfileUTF8(this.filePath.join("/")),
                extensions: this.extensions.concat(
                    await this.loadLanguageExtensions(),
                ),
                parent: this.parent,
            });
        } else if (
            Object.values(IMAGE_Ext).find((ext) =>
                this.filePath.at(-1)?.endsWith(ext),
            )
        ) {
            const imageContainer = document.createElement("div");
            imageContainer.classList.add("img-container");

            const img = document.createElement("img");
            const imageData = new Uint8Array(
                await rpc().fs.readfile(this.filePath.join("/")),
            );
            const imageBlob = new Blob([imageData]);
            img.src = window.URL.createObjectURL(imageBlob);
            imageContainer.append(img);
            setTimeout(() => window.URL.revokeObjectURL(img.src), 1000);

            this.parent.append(imageContainer);
        }
    }

    private updateThrottler: ReturnType<typeof setTimeout> | null;
    async updateFile() {
        if (this.updateThrottler) clearTimeout(this.updateThrottler);

        this.updateThrottler = null;

        const contents = this.editor?.state?.doc?.toString();
        if (!contents) return;

        const exists = await rpc().fs.exists(this.filePath.join("/"));
        if (!exists) return;

        rpc().fs.putfileUTF8(this.filePath.join("/"), contents);
    }

    private updateFileContents() {
        this.updateThrottler = setTimeout(this.updateFile.bind(this), 2000);
    }

    private async loadLanguageExtensions() {
        const filename = this.filePath.at(-1) as string;
        const extensions: Extension[] = [];

        if (
            filename.endsWith(UTF8_Ext.JAVASCRIPT) ||
            filename.endsWith(UTF8_Ext.JAVASCRIPT_X) ||
            filename.endsWith(UTF8_Ext.JAVASCRIPT_M) ||
            filename.endsWith(UTF8_Ext.JAVASCRIPT_C) ||
            filename.endsWith(UTF8_Ext.TYPESCRIPT) ||
            filename.endsWith(UTF8_Ext.TYPESCRIPT_X)
        ) {
            const jsLang = await import("@codemirror/lang-javascript");
            extensions.push(
                jsLang.javascript({
                    typescript:
                        filename.endsWith(UTF8_Ext.TYPESCRIPT) ||
                        filename.endsWith(UTF8_Ext.TYPESCRIPT_X),
                    jsx: filename.endsWith("x"),
                }),
                lintGutter(),
            );

            if (
                filename.endsWith(UTF8_Ext.JAVASCRIPT) ||
                filename.endsWith(UTF8_Ext.JAVASCRIPT_X) ||
                filename.endsWith(UTF8_Ext.JAVASCRIPT_M) ||
                filename.endsWith(UTF8_Ext.JAVASCRIPT_C)
            ) {
                extensions.push(
                    jsLang.javascriptLanguage.data.of({
                        autocomplete: jsLang.scopeCompletionSource(globalThis),
                    }),
                );
            }
        } else if (filename.endsWith(UTF8_Ext.HTML)) {
            extensions.push((await import("@codemirror/lang-html")).html());
        } else if (filename.endsWith(UTF8_Ext.CSS)) {
            extensions.push((await import("@codemirror/lang-css")).css());
        } else if (filename.endsWith(UTF8_Ext.JSON)) {
            const jsonLang = await import("@codemirror/lang-json");
            extensions.push(jsonLang.json());
            extensions.push(linter(jsonLang.jsonParseLinter()));
        } else if (
            filename.endsWith(UTF8_Ext.SASS) ||
            filename.endsWith(UTF8_Ext.SCSS)
        ) {
            extensions.push(
                (await import("@codemirror/lang-sass")).sass({
                    indented: filename.endsWith(UTF8_Ext.SCSS),
                }),
            );
        } else if (filename.endsWith(UTF8_Ext.MARKDOWN)) {
            extensions.push(
                (await import("@codemirror/lang-markdown")).markdown(),
            );
        }

        return extensions;
    }

    async render() {
        this.parent.classList.add("editor");
        return this.parent;
    }
}
