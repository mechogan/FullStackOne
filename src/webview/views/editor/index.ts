import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from '@codemirror/lang-javascript';

export class Editor {
    onTextChange: (value: string) => void;

    private extensions = [
        basicSetup,
        oneDark,
        javascript(),
        EditorView.updateListener.of(e => {
            if(this.onTextChange)
                this.onTextChange(e.state.doc.toString())
        })
    ]
    private parent = document.createElement("div");
    private editor: EditorView;

    render() {
        if(!this.editor) {
            this.editor = new EditorView({
                doc: "",
                extensions: this.extensions,
                parent: this.parent
            });
        }
        
        return this.parent
    }
}