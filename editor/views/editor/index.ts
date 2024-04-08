import "./index.css";
import { EditorView, keymap, hoverTooltip } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { indentWithTab } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { autocompletion } from "@codemirror/autocomplete";
import {
    linter,
    lintGutter,
    setDiagnostics,
    Diagnostic
} from "@codemirror/lint";
import { Extension } from "@codemirror/state";
import rpc from "../../rpc";
import { tsWorker } from "../../typescript";
import { PackageInstaller } from "../../packages/installer";

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
    SCSS = ".scss"
}

enum IMAGE_Ext {
    PNG = ".png",
    JPG = ".jpg",
    JPEG = ".jpeg",
    GIF = ".gif",
    WEBP = ".webp",
    BMP = ".bmp"
}

export class Editor {
    static tsWorker: tsWorker;

    private extensions = [
        basicSetup,
        oneDark,
        keymap.of([indentWithTab]),
        indentUnit.of("    "), // 4 spaces
        EditorView.updateListener.of(this.updateFileContents.bind(this))
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
                message: error.message
            };
        });
        this.editor.dispatch(setDiagnostics(this.editor.state, diagnostics));
    }

    private async restartTSWorker(contents?: string) {
        if (Editor.tsWorker) Editor.tsWorker.worker.terminate();
        Editor.tsWorker = new tsWorker();
        await Editor.tsWorker.ready();
        await Editor.tsWorker.call().start("");
        await Editor.tsWorker
            .call()
            .updateFile(
                this.filePath.join("/"),
                contents || this.editor.state.doc.toString()
            );
    }

    async loadFileContents() {
        if (this.editor) {
            this.editor.dom.remove();
        }

        if (
            Object.values(UTF8_Ext).find((ext) =>
                this.filePath.at(-1)?.endsWith(ext)
            )
        ) {
            const doc = (await rpc().fs.readFile(this.filePath.join("/"), {
                encoding: "utf8",
                absolutePath: true
            })) as string;

            if (
                this.filePath.at(-1).endsWith(UTF8_Ext.TYPESCRIPT) ||
                this.filePath.at(-1).endsWith(UTF8_Ext.TYPESCRIPT_X)
            ) {
                await this.restartTSWorker(doc);
            }

            this.editor = new EditorView({
                doc,
                extensions: this.extensions.concat(
                    await this.loadLanguageExtensions()
                ),
                parent: this.parent
            });
        } else if (
            Object.values(IMAGE_Ext).find((ext) =>
                this.filePath.at(-1)?.endsWith(ext)
            )
        ) {
            const imageContainer = document.createElement("div");
            imageContainer.classList.add("img-container");

            const img = document.createElement("img");
            const imageData = await rpc().fs.readFile(this.filePath.join("/"), {
                absolutePath: true
            });
            const imageBlob = new Blob([imageData]);
            img.src = window.URL.createObjectURL(imageBlob);
            imageContainer.append(img);
            setTimeout(() => window.URL.revokeObjectURL(img.src), 1000);

            this.parent.append(imageContainer);
        }
    }

    private updateThrottler: ReturnType<typeof setTimeout> | null;
    async updateFile() {
        const contents = this.editor?.state?.doc?.toString();
        if (!contents) return;

        if (
            this.filePath.at(-1).endsWith(UTF8_Ext.TYPESCRIPT) &&
            Editor.tsWorker
        ) {
            return Editor.tsWorker
                .call()
                .updateFile(this.filePath.join("/"), contents);
        }

        if (this.updateThrottler) clearTimeout(this.updateThrottler);

        this.updateThrottler = null;

        const exists = await rpc().fs.exists(this.filePath.join("/"), {
            absolutePath: true
        });
        if (!exists) return;

        rpc().fs.writeFile(this.filePath.join("/"), contents, {
            absolutePath: true
        });
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
                    jsx: filename.endsWith("x")
                }),
                lintGutter()
            );

            if (
                filename.endsWith(UTF8_Ext.JAVASCRIPT) ||
                filename.endsWith(UTF8_Ext.JAVASCRIPT_X) ||
                filename.endsWith(UTF8_Ext.JAVASCRIPT_M) ||
                filename.endsWith(UTF8_Ext.JAVASCRIPT_C)
            ) {
                extensions.push(
                    jsLang.javascriptLanguage.data.of({
                        autocomplete: jsLang.scopeCompletionSource(globalThis)
                    })
                );
            }

            // typescript
            else {
                const tsErrorLinter = async () => {
                    await Editor.tsWorker
                        .call()
                        .updateFile(
                            this.filePath.join("/"),
                            this.editor.state.doc.toString()
                        );

                    const getAllTsError = async () => {
                        const [
                            semanticDiagnostics,
                            syntacticDiagnostics,
                            suggestionDiagnostics
                        ] = await Promise.all([
                            Editor.tsWorker
                                .call()
                                .getSemanticDiagnostics(
                                    this.filePath.join("/")
                                ),
                            Editor.tsWorker
                                .call()
                                .getSyntacticDiagnostics(
                                    this.filePath.join("/")
                                ),
                            Editor.tsWorker
                                .call()
                                .getSuggestionDiagnostics(
                                    this.filePath.join("/")
                                )
                        ]);

                        return semanticDiagnostics
                            .concat(syntacticDiagnostics)
                            .concat(suggestionDiagnostics);
                    };

                    let tsErrors = await getAllTsError();

                    const needsTypes = tsErrors.filter((e) => {
                        if (e.code !== 7016) return false;

                        const text =
                            e.file?.text || this.editor.state.doc.toString();

                        const moduleName = text
                            .toString()
                            .slice(e.start, e.start + e.length)
                            .slice(1, -1);

                        return !moduleName.startsWith(".");
                    });
                    if (needsTypes.length) {
                        await PackageInstaller.install(
                            needsTypes.map((e) => {
                                const text =
                                    e.file?.text ||
                                    this.editor.state.doc.toString();
                                const moduleName = text
                                    .toString()
                                    .slice(e.start, e.start + e.length)
                                    .slice(1, -1);
                                return {
                                    name: `@types/${moduleName}`,
                                    deep: true
                                };
                            })
                        );

                        await this.restartTSWorker();
                        tsErrors = await getAllTsError();
                    }

                    return tsErrors.map((tsError) => ({
                        from: tsError.start,
                        to: tsError.start + tsError.length,
                        severity: "error",
                        message:
                            typeof tsError.messageText === "string"
                                ? tsError.messageText
                                : tsError.messageText.messageText
                    }));
                };

                const tsComplete = async (ctx) => {
                    const text = ctx.state.doc.toString();
                    await Editor.tsWorker
                        .call()
                        .updateFile(this.filePath.join("/"), text);

                    let tsCompletions = await Editor.tsWorker
                        .call()
                        .getCompletionsAtPosition(
                            this.filePath.join("/"),
                            ctx.pos,
                            {}
                        );

                    if (!tsCompletions) return { from: ctx.pos, options: [] };

                    let lastWord, from;
                    for (let i = ctx.pos - 1; i >= 0; i--) {
                        if (
                            [
                                " ",
                                ".",
                                "\n",
                                ":",
                                "{",
                                "<",
                                '"',
                                "'",
                                "(",
                                "["
                            ].includes(text[i]) ||
                            i === 0
                        ) {
                            from = i === 0 ? i : i + 1;
                            lastWord = text.slice(from, ctx.pos).trim();
                            break;
                        }
                    }

                    if (lastWord) {
                        tsCompletions.entries = tsCompletions.entries.filter(
                            (completion) => completion.name.startsWith(lastWord)
                        );
                    }

                    return {
                        from: ctx.pos,
                        options: tsCompletions.entries.map((completion) => ({
                            label: completion.name,
                            apply: (view: EditorView) => {
                                view.dispatch({
                                    changes: {
                                        from,
                                        to: ctx.pos,
                                        insert: completion.name
                                    }
                                });
                                if (from === ctx.pos) {
                                    view.dispatch({
                                        selection: {
                                            anchor:
                                                from + completion.name.length,
                                            head: from + completion.name.length
                                        }
                                    });
                                }
                            }
                        }))
                    };
                };

                const tsTypeDefinition = async (view, pos, side) => {
                    const info = await Editor.tsWorker.call().getQuickInfoAtPosition(this.filePath.join("/"), pos)
                    const text = info?.displayParts?.map(({text}) => text).join("");

                    if(!text) return null;

                    return {
                        pos: info.textSpan.start,
                        end: info.textSpan.start + info.textSpan.length,
                        above: true,
                        create(view) {
                            let dom = document.createElement("div");
                            const pre = document.createElement("pre");
                            pre.innerText = text;
                            dom.append(pre);
                            return { dom };
                        }
                    };
                };

                extensions.push(
                    linter(tsErrorLinter as () => Promise<Diagnostic[]>),
                    autocompletion({ override: [tsComplete] }),
                    hoverTooltip(tsTypeDefinition)
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
                    indented: filename.endsWith(UTF8_Ext.SCSS)
                })
            );
        } else if (filename.endsWith(UTF8_Ext.MARKDOWN)) {
            extensions.push(
                (await import("@codemirror/lang-markdown")).markdown()
            );
        }

        return extensions;
    }

    async render() {
        this.parent.classList.add("editor");
        return this.parent;
    }
}
