import "./index.scss";
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { oneDark } from "@codemirror/theme-one-dark";
import { indentWithTab } from "@codemirror/commands"
import { linter } from "@codemirror/lint";
import { Extension } from "@codemirror/state";
import { rpc } from '../../rpc';

export class Editor {
    private extensions = [
        basicSetup,
        oneDark,
        keymap.of([indentWithTab]),
        EditorView.updateListener.of(this.updateFileContents.bind(this))
    ]
    private parent = document.createElement("div");
    private editor: EditorView;
    filePath: string[];

    constructor(filePath: string[]) {
        this.filePath = filePath;

        this.loadFileContents();
    }

    private async loadFileContents() {
        this.editor = new EditorView({
            doc: await rpc().fs.readfile(this.filePath.join("/")),
            extensions: this.extensions.concat(await this.loadLanguageExtensions()),
            parent: this.parent
        });
    }

    private updateThrottler: ReturnType<typeof setTimeout> | null;
    private updateFileContents() {
        if (this.updateThrottler)
            clearTimeout(this.updateThrottler);

        this.updateThrottler = setTimeout(() => {
            this.updateThrottler = null;
            const contents = this.editor.state.doc.toString();
            rpc().fs.putfile(this.filePath.join("/"), contents);
        }, 2000);
    }

    private async loadLanguageExtensions() {
        const filename = this.filePath.at(-1) as string;
        const extensions: Extension[] = [];

        if (filename.endsWith("js")
            || filename.endsWith(".jsx")
            || filename.endsWith(".ts")
            || filename.endsWith(".tsx")
        ) {
            const jsLang = await import("@codemirror/lang-javascript");
            extensions.push(
                jsLang.javascript({
                    typescript: filename.endsWith(".ts") || filename.endsWith(".tsx"),
                    jsx: filename.endsWith("x")
                })
            );

            if (filename.endsWith("js") || filename.endsWith("jsx")) {
                const eslint = await import("eslint-linter-browserify");
                extensions.push(linter(jsLang.esLint(new eslint.Linter())));
                extensions.push(
                    jsLang.javascriptLanguage.data.of({
                        autocomplete: jsLang.scopeCompletionSource(globalThis)
                    })
                )
            }

            if (filename.endsWith("js")) {

            }
        } else if (filename.endsWith(".html")) {
            extensions.push((await import("@codemirror/lang-html")).html());
        } else if (filename.endsWith(".css")) {
            extensions.push((await import("@codemirror/lang-css")).css());
        } else if (filename.endsWith(".json")) {
            const jsonLang = await import("@codemirror/lang-json");
            extensions.push(jsonLang.json());
            extensions.push(linter(jsonLang.jsonParseLinter()));
        } else if (filename.endsWith(".sass") || filename.endsWith(".scss")) {
            extensions.push((await import("@codemirror/lang-sass")).sass({
                indented: filename.endsWith(".scss")
            }));
        } else if (filename.endsWith(".md")) {
            extensions.push((await import("@codemirror/lang-markdown")).markdown())
        }

        return extensions;
    }

    async render() {
        this.parent.classList.add("editor");
        return this.parent;
    }
}