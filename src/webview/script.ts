import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from '@codemirror/lang-javascript';
import { rpc } from './rpc';

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

const nav = document.body.querySelector("nav") as HTMLElement;
nav.innerHTML = `<ul>${(await rpc.fs.readdir("."))
    .map(({name, isDirectory}) => `<li>${isDirectory ? ">" : "└"} ${name}</li>`).join("")}</ul>`