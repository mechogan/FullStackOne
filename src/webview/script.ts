import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from '@codemirror/lang-javascript';

const contents = await (await fetch("/contents")).text();

// CodeMirror 6 initialization
new EditorView({
    doc: contents,
    extensions: [
        basicSetup,
        oneDark,
        javascript(),
    ],
    parent: document.body.querySelector("main") as HTMLElement,
});


document.querySelector("button")?.addEventListener("click", async () => {
    const pre = document.querySelector("pre");
    if(!pre) return;

    const response = await (await fetch("/data")).text();
    try{
        pre.innerText = JSON.stringify(response, null, 2);
    }catch (e) {
        pre.innerText = response;
    }
    
})