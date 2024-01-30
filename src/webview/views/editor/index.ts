import "./index.scss";
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { oneDark } from "@codemirror/theme-one-dark";
import {indentWithTab} from "@codemirror/commands"
import { javascript, javascriptLanguage, scopeCompletionSource } from '@codemirror/lang-javascript';
import { rpc } from '../../rpc';

export class Editor {
    private extensions = [
        basicSetup,
        oneDark,
        javascript(),
        keymap.of([indentWithTab]),
        javascriptLanguage.data.of({
            autocomplete: scopeCompletionSource(globalThis)
        }),
        EditorView.updateListener.of(this.updateFileContents.bind(this))
    ]
    private parent = document.createElement("div");
    private editor: EditorView;
    filePath: string[];

    constructor(filePath: string[]) {
        this.filePath = filePath;

        this.loadFileContents();
    }

    private async loadFileContents(){
        this.editor = new EditorView({
            doc: await rpc().fs.readfile(this.filePath.join("/")),
            extensions: this.extensions,
            parent: this.parent
        });
    }

    private updateThrottler: ReturnType<typeof setTimeout> | null;
    private updateFileContents(){
        if(this.updateThrottler)
            clearTimeout(this.updateThrottler);

        this.updateThrottler = setTimeout(() => { 
            this.updateThrottler = null;
            const contents = this.editor.state.doc.toString();
            rpc().fs.putfile(this.filePath.join("/"), contents);
        }, 2000);
    }

    async render() {
        this.parent.classList.add("editor");
        return this.parent;
    }
}