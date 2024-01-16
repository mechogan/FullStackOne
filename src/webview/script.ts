import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from '@codemirror/lang-javascript';

// CodeMirror 6 initialization
new EditorView({
    doc: "",
    extensions: [
        basicSetup,
        oneDark,
        javascript(),
    ],
    parent: document.body.querySelector("main") as HTMLElement,
});

