import type { Dirent } from "../../../src/adapter/fs";
import { Button } from "../../components/primitives/button";
import { NEW_FILE_ID } from "../../constants";
import { Store } from "../../store";
import { ipcEditor } from "../../store/ipc";
import { Project } from "../../types";

export function FileTree(project: Project) {
    const container = document.createElement("div");
    container.classList.add("file-tree");

    container.append(
        TopActions(),
        TreeRecursive(project.id)
    )

    return container;
}

function TopActions() {
    const container = document.createElement("div");

    const left = document.createElement("div");
    const toggleSidePanel = Button({
        style: "icon-small",
        iconLeft: "Side Panel"
    });
    toggleSidePanel.onclick = () => {
        Store.codeEditor.setSidePanelClosed(true);
    }
    left.append(toggleSidePanel);

    const right = document.createElement("div");
    const newFileButton = Button({
        style: "icon-small",
        iconLeft: "File Add"
    });
    newFileButton.id = NEW_FILE_ID;

    const newDirectoryButton = Button({
        style: "icon-small",
        iconLeft: "Directory Add"
    });

    const uploadButton = Button({
        style: "icon-small",
        iconLeft: "Upload"
    });

    right.append(newFileButton, newDirectoryButton, uploadButton);


    container.append(
        left,
        right
    )

    return container
}


function TreeRecursive(directory: string) {
    const container = document.createElement("ul");

    ipcEditor.fs.readdir(directory, { withFileTypes: true })
        .then(items => {
            const itemsElements = items
                .filter(
                    ({ name }) => !name.startsWith(".build") && !name.startsWith(".git")
                )
                .sort((a, b) => {
                    if (a.isDirectory && !b.isDirectory) {
                        return -1;
                    } else if (!a.isDirectory && b.isDirectory) {
                        return 1;
                    }

                    return a.name.toUpperCase() < b.name.toUpperCase() ? -1 : 1;
                })
                .map((dirent) => Item(directory, dirent));
            container.append(...itemsElements);
        })

    return container;
}

function Item(parentDirectory: string, itemDirent: Dirent) {
    const item = document.createElement("li");

    item.innerText = itemDirent.name;

    return item;
}