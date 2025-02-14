import core_message from "../../../lib/core_message";
import { createElement } from "../../components/element";
import { Button } from "../../components/primitives/button";
import { createRefresheable } from "../../components/refresheable";
import { Store } from "../../store";
import { Project } from "../../types";
import { CodeEditor } from "./code-editor";
import { FileEvent, FileEventType } from "./file-tree";

export function Editor(project: Project) {
    const container = createElement("div");
    container.classList.add("editor");

    const refresheableFileTabs = createRefresheable(FileTabs);
    Store.editor.codeEditor.openedFiles.subscribe(refresheableFileTabs.refresh);

    const codeEditor = CodeEditor(project);

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

    const removeIfDeleted = (eStr: string) => {
        const fileEvents: FileEvent[] = JSON.parse(eStr);
        for(const e of fileEvents) {
            if(e.type !== FileEventType.DELETED) continue;
            if(e.paths.find(p => isChildOf(path, p))) {
                Store.editor.codeEditor.closeFile(path);
                break;
            }
        }
    }

    core_message.addListener("file-event", removeIfDeleted)

    Store.editor.codeEditor.focusedFile.subscribe(onFocusFileChange);
    li.ondestroy = () => {
        core_message.removeListener("file-event", removeIfDeleted)
        Store.editor.codeEditor.focusedFile.unsubscribe(onFocusFileChange);
    };

    return li;
}

function isChildOf(path: string, eventPath: string) {
    if(!eventPath) return false
    const rootDir = path.split("/").at(0);
    const [_, filePath] = eventPath.split(rootDir + "/");
    if(!filePath) {
        return false;
    }

    const pathComponents = path.split("/").slice(1);
    const eventPathComponents = filePath.split("/");
    
    for(let i = 0; i < eventPathComponents.length; i++){
        if(eventPathComponents[i] !== pathComponents[i])
            return false;
    }

    return true;
}