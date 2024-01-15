import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from '@codemirror/lang-javascript';

// CodeMirror 6 initialization
const editor = new EditorView({
    doc: `const foo = "Hello World";
console.log(foo);`,
    extensions: [
        basicSetup,
        oneDark,
        javascript(),
    ],
    parent: document.body.querySelector("main") as HTMLElement,
});