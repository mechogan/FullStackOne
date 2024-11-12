import type { Dirent } from "../../../src/adapter/fs";
import { createElement, ElementComponent } from "../../components/element";
import { Button } from "../../components/primitives/button";
import { Icon } from "../../components/primitives/icon";
import { NEW_FILE_ID } from "../../constants";
import { Store } from "../../store";
import { ipcEditor } from "../../store/ipc";
import { Project } from "../../types";

export function FileTree(project: Project) {
    const container = createElement("div");
    container.classList.add("file-tree");

    Store.editor.fileTree.setActiveItem(null);
    Store.editor.fileTree.clearOpenedDirectories();

    const scrollableTree = document.createElement("div");
    const treeRecursive = TreeRecursive(project.id);
    scrollableTree.append(treeRecursive);

    container.append(TopActions(), scrollableTree);

    container.ondestroy = () => {
        treeRecursive.destroy();
    };

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
        Store.editor.setSidePanelClosed(true);
    };
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

    container.append(left, right);

    return container;
}

function TreeRecursive(directory: string) {
    const container = createElement("ul");

    let children: ReturnType<typeof Item>[] = [];
    ipcEditor.fs.readdir(directory, { withFileTypes: true }).then((items) => {
        children = items
            .filter(
                ({ name }) =>
                    !name.startsWith(".build") && !name.startsWith(".git")
            )
            .sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) {
                    return -1;
                } else if (!a.isDirectory && b.isDirectory) {
                    return 1;
                }

                return a.name.toUpperCase() < b.name.toUpperCase() ? -1 : 1;
            })
            .map((dirent) => ({
                ...dirent,
                parentDirectory: directory
            }))
            .map(Item);
        container.append(...children);
    });

    container.ondestroy = () => {
        children.forEach((e) => e.destroy());
    };

    return container;
}

function Item(item: Dirent & { parentDirectory: string }) {
    const container = createElement("li");

    const path = item.parentDirectory + "/" + item.name;

    const nameAndOptions = document.createElement("div");
    nameAndOptions.classList.add("name-and-options");
    container.append(nameAndOptions);

    const nameContainer = document.createElement("div");
    nameContainer.classList.add("name");
    nameContainer.innerHTML = `<span>${item.name}</span>`;
    nameAndOptions.append(nameContainer);

    const options = Button({
        style: "icon-small",
        iconLeft: "Options"
    });
    options.onclick = ItemOptions;
    nameAndOptions.append(options);

    if (item.isDirectory) {
        const icon = Icon("Caret");
        nameContainer.prepend(icon);
    }

    container.append(nameAndOptions);

    const onActiveItemChange = (activeItem: string) => {
        if (activeItem === path) {
            container.classList.add("active");
        } else {
            container.classList.remove("active");
        }
    };

    Store.editor.fileTree.activeItem.subscribe(onActiveItemChange);

    nameAndOptions.onclick = () => {
        Store.editor.fileTree.setActiveItem(path);
        if (item.isDirectory) {
            Store.editor.fileTree.toggleDirectory(path);
        } else {
            Store.editor.codeEditor.openFile(path);
            Store.editor.codeEditor.focusFile(path);
        }
    };

    let children: ElementComponent;
    let onOpenedDirectoryChange = (openedDirectories: Set<string>) => {
        if (openedDirectories.has(path)) {
            container.classList.add("opened");
            if (children) return;
            children = TreeRecursive(path);
            container.append(children);
        } else {
            container.classList.remove("opened");
            children?.remove();
            children?.destroy();
            children = null;
        }
    };
    Store.editor.fileTree.openedDirectories.subscribe(onOpenedDirectoryChange);

    container.ondestroy = () => {
        Store.editor.fileTree.activeItem.unsubscribe(onActiveItemChange);
        Store.editor.fileTree.openedDirectories.unsubscribe(
            onOpenedDirectoryChange
        );
        children?.destroy();
    };

    return container;
}

function ItemOptions() {}
