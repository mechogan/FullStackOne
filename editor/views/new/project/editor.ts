import { Button } from "../../../components/primitives/button";
import { CodeEditor } from "./code-editor";

type EditorOpts = {
    directory: string;
};

export function Editor(opts: EditorOpts) {
    const container = document.createElement("div");
    container.classList.add("editor");

    const editorContainer = document.createElement("div");
    CodeEditor.parent = {
        workingDirectory: opts.directory,
        element: editorContainer
    };
    container.append(FileTabs(), editorContainer);

    return container;
}

function FileTabs() {
    const container = document.createElement("ul");
    container.classList.add("file-tabs");

    const renderTabs = () => {
        Array.from(container.children).forEach((child) => child.remove());

        let openedTab: HTMLLIElement;
        CodeEditor.activeFiles.forEach((item) => {
            const li = document.createElement("li");
            if (item.path === CodeEditor.openedFilePath) {
                li.classList.add("opened");
                openedTab = li;
            } else {
                li.onclick = () => CodeEditor.addFile(item.path);
            }

            const name = document.createElement("span");
            name.innerText = item.path.split("/").pop();

            const closeButton = Button({
                style: "icon-small",
                iconLeft: "Close"
            });

            closeButton.onclick = (e) => {
                e.stopPropagation();
                CodeEditor.remove(item.path);
            };

            li.append(name, closeButton);

            container.append(li);
        });

        if (openedTab) {
            openedTab.scrollIntoView();
        }
    };

    CodeEditor.onActiveFileChange = renderTabs;
    renderTabs();

    return container;
}
