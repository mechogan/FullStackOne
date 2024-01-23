import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from '@codemirror/lang-javascript';

export class Editor {
    private extensions = [
        basicSetup,
        oneDark,
        javascript(),
    ]
    private parent = document.createElement("div");
    private editor: EditorView;

    constructor() {
        this.editor = new EditorView({
            doc: "",
            extensions: this.extensions,
            parent: this.parent
        })
    }

    render() {
        

        return this.parent
    }
}