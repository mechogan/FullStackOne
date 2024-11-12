import { createElement } from "../../components/element";
import { Button } from "../../components/primitives/button";
import { createRefresheable } from "../../components/refresheable";
import { Store } from "../../store";
import { Project } from "../../types";
import { CodeEditor } from "./code-editor";

export function Editor(project: Project) {
    const container = createElement("div");
    container.classList.add("editor");

    const refresheableFileTabs = createRefresheable(FileTabs);
    Store.editor.codeEditor.openedFiles.subscribe(refresheableFileTabs.refresh);

    const codeEditor = CodeEditor();

    container.append(refresheableFileTabs.element, codeEditor);

    container.ondestroy = () => {
        Store.editor.codeEditor.openedFiles.unsubscribe(
            refresheableFileTabs.refresh
        );
        refresheableFileTabs.element.destroy();
        codeEditor.destroy();
    };

    return container;
}

function FileTabs(openedFiles: Set<string>) {
    const container = createElement("ul");
    container.classList.add("file-tabs");

    const items = Array.from(openedFiles).map(Tab);

    container.append(...items);

    container.ondestroy = () => {
        items.forEach((e) => e.destroy());
    };

    return container;
}

function Tab(path: string) {
    const li = createElement("li");

    const name = document.createElement("span");
    name.innerText = path.split("/").pop();

    const closeButton = Button({
        style: "icon-small",
        iconLeft: "Close"
    });

    closeButton.onclick = (e) => {
        e.stopPropagation();
        Store.editor.codeEditor.closeFile(path);
    };

    li.append(name, closeButton);

    li.onclick = () => {
        Store.editor.codeEditor.focusFile(path);
    };

    const onFocusFileChange = (focusedFile: string) => {
        if (focusedFile === path) {
            li.classList.add("opened");
            li.scrollIntoView();
        } else {
            li.classList.remove("opened");
        }
    };

    Store.editor.codeEditor.focusedFile.subscribe(onFocusFileChange);
    li.ondestroy = () => {
        Store.editor.codeEditor.focusedFile.unsubscribe(onFocusFileChange);
    };

    return li;
}
