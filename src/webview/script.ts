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


async function openDirectory(pathComponents: string[], parentElement: HTMLElement) {
    const ul = document.createElement("ul");
    (await rpc().fs.readdir(pathComponents.join("/")))
        .forEach(({name, isDirectory}) => {
            const li = document.createElement("li")
            li.innerText = `${isDirectory ? "▶" : ""} ${name}`;
            if(isDirectory){
                li.addEventListener("click", async (e) => {
                    e.stopPropagation();

                    const expand = !(li.getAttribute("aria-expanded") === "true")
                    li.innerText = `${expand ? "▼" : "▶"} ${name}`;

                    if(expand){
                        await openDirectory([...pathComponents, name], li);
                    }
                    else {
                        li.querySelector("ul")?.remove();
                    }

                    li.setAttribute("aria-expanded", expand.toString());
                })
            }
            ul.append(li);
        })
    parentElement.append(ul);
}

const nav = document.body.querySelector("nav") as HTMLElement;
openDirectory([], nav);