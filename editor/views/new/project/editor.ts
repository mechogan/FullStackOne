import type { Project } from "../../../api/config/types";
import { Button } from "../../../components/primitives/button";
import { CodeEditor } from "./code-editor";

type EditorOpts = {
    directory: string;
}

export function Editor(opts: EditorOpts) {
    const container = document.createElement("div");
    container.classList.add("editor");

    const editorContainer = document.createElement("div");
    CodeEditor.setParent(opts.directory, editorContainer);

    container.append(FileTabs(), editorContainer);

    return container;
}

function FileTabs() {
    const container = document.createElement("ul");
    container.classList.add("file-tabs");

    const renderTabs = () => {
        Array.from(container.children).forEach(child => child.remove());

        CodeEditor.activeFiles.forEach((item) => {
            const li = document.createElement("li");
            if(item.path === CodeEditor.openedFilePath) {
                li.classList.add("opened");
            } else {
                li.onclick = () => CodeEditor.open(item.path);
            }

            const name = document.createElement("span");
            name.innerText = item.path.split("/").pop();
    
            const closeButton = Button({
                style: "icon-small",
                iconLeft: "Close"
            });

            closeButton.onclick = e => {
                e.stopPropagation()
                CodeEditor.remove(item.path);
            };
    
            li.append(name, closeButton);
    
            container.append(li);
        });
    }

    CodeEditor.onActiveFileChange = renderTabs;
    renderTabs();

    return container;
}
