import { createElement, ElementComponent } from "../../components/element";
import { Button, ButtonGroup } from "../../components/primitives/button";
import { Icon } from "../../components/primitives/icon";
import { NEW_FILE_ID } from "../../constants";
import { Store } from "../../store";
import { ipcEditor } from "../../ipc";
import { Project } from "../../types";
import { Popover } from "../../components/popover";
import { InputText } from "../../components/primitives/inputs";
import { createRefresheable } from "../../components/refresheable";

type FileTreeItemCommon = {
    name: string;
    parent: string;
    element: ElementComponent<HTMLLIElement>;
    elementName: HTMLSpanElement;
};

type FileTreeItemFile = FileTreeItemCommon & {
    type: "file";
};

type FileTreeItemDirectory = FileTreeItemCommon & {
    type: "directory";
    childrenList: null | ElementComponent<HTMLUListElement>;
    children: null | string[];
};

type FileTreeItem = FileTreeItemFile | FileTreeItemDirectory;

type FileTree = Map<string, FileTreeItem>;

export let refreshFullFileTree: () => void;

let tree: FileTree,
    activeItemPath: string,
    openedFileTreeItemDirectoryPath = new Set<string>();
export function FileTree(project: Project) {
    const container = createElement("div");
    container.classList.add("file-tree");

    const renderFileTree = async () => {
        const maybeUpdateRoot = (tree?.get(project.id) as FileTreeItemDirectory)
            ?.childrenList;
        if (maybeUpdateRoot) {
            refresheableFileTree.element = maybeUpdateRoot;
        }

        const root = createElement("ul");

        tree = new Map([
            [
                project.id,
                {
                    type: "directory",
                    name: project.id,
                    parent: "",
                    element: createElement("li"),
                    elementName: null,
                    childrenList: root,
                    children: null
                }
            ]
        ]);

        const rootItems = await OpenDirectory(project.id, true);
        root.append(...rootItems);

        return root;
    };

    const scrollableTree = document.createElement("div");
    const refresheableFileTree = createRefresheable(renderFileTree);
    scrollableTree.append(refresheableFileTree.element);
    refreshFullFileTree = () => refresheableFileTree.refresh();
    refreshFullFileTree();

    const topActions = TopActions(project);

    container.append(topActions, scrollableTree);

    container.ondestroy = () => {
        topActions.destroy();

        tree = null;
        activeItemPath = null;
        openedFileTreeItemDirectoryPath = new Set();
    };

    return container;
}

function TopActions(project: Project) {
    const container = createElement("div");

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
    newFileButton.onclick = () => {
        newFileItemForm(project, false);
    };

    const newDirectoryButton = Button({
        style: "icon-small",
        iconLeft: "Directory Add"
    });
    newDirectoryButton.onclick = () => {
        newFileItemForm(project, true);
    };

    const uploadButton = Button({
        style: "icon-small",
        iconLeft: "Upload"
    });
    uploadButton.classList.add("import-file");
    const form = document.createElement("form");
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (!file) {
            form.reset();
            return;
        }

        const activeItem = tree.get(activeItemPath);
        const parentPath = activeItem
            ? activeItem.type === "file"
                ? activeItem.parent
                : activeItemPath
            : project.id;
        const path = parentPath + "/" + file.name;
        const data = new Uint8Array(await file.arrayBuffer());

        ipcEditor.fs
            .writeFile(path, data)
            .then(() => OpenDirectory(parentPath));
        form.reset();
    };
    form.append(fileInput);
    uploadButton.append(form);
    uploadButton.onclick = () => fileInput.click();

    right.append(newFileButton, newDirectoryButton, uploadButton);

    container.append(left, right);

    return container;
}

async function OpenDirectory(
    fileTreeItemDirectoryPath: string,
    returnChildren = false
) {
    const fileTreeItem = tree.get(fileTreeItemDirectoryPath);

    // undiscovered directory
    if (!fileTreeItem) {
        return;
    } else if (fileTreeItem.type === "file") {
        return;
    }

    openedFileTreeItemDirectoryPath.add(fileTreeItemDirectoryPath);

    const fileTreeItemDirectory = fileTreeItem as FileTreeItemDirectory;

    const children = await ipcEditor.fs.readdir(fileTreeItemDirectoryPath, {
        withFileTypes: true
    });
    fileTreeItemDirectory.children = children.map((child) => {
        const childPath = `${fileTreeItemDirectoryPath}/${child.name}`;
        const { element, elementName } = createFileTreeElement({
            path: childPath,
            ...child
        });
        if (child.isDirectory) {
            element.onclick = (e) => {
                e.stopPropagation();
                ToggleDirectory(childPath);
                setActiveItem(childPath);
            };

            tree.set(childPath, {
                type: "directory",
                name: child.name,
                parent: fileTreeItemDirectoryPath,
                childrenList: null,
                children: null,
                element,
                elementName
            });
        } else {
            element.onclick = (e) => {
                e.stopPropagation();
                setActiveItem(childPath);
                Store.editor.codeEditor.openFile(childPath);
                Store.editor.codeEditor.focusFile(childPath);
            };

            tree.set(childPath, {
                type: "file",
                name: child.name,
                parent: fileTreeItemDirectoryPath,
                element,
                elementName
            });
        }

        if (activeItemPath === childPath) {
            setActiveItem(childPath);
        }

        return childPath;
    });

    const childrenElements = fileTreeItemDirectory.children
        .map((childPath) => tree.get(childPath))
        .filter(filterFilesAndDirectories)
        .sort(sortFilesAndDirectories)
        .map((child) => child.element);

    fileTreeItemDirectory.element?.classList?.add("opened");

    if (!returnChildren) {
        const childrenList = createElement("ul");
        childrenList.onclick = (e) => e.stopPropagation();
        childrenList.append(...childrenElements);

        if (fileTreeItemDirectory.childrenList === null) {
            fileTreeItemDirectory.element.append(childrenList);
        } else {
            fileTreeItemDirectory.childrenList.replaceWith(childrenList);
        }

        fileTreeItemDirectory.childrenList = childrenList;
    }

    const openSubDirectoriesPromises = fileTreeItemDirectory.children
        .filter((childPath) => {
            const fileTreeItem = tree.get(childPath);
            return (
                fileTreeItem &&
                fileTreeItem.type === "directory" &&
                openedFileTreeItemDirectoryPath.has(childPath)
            );
        })
        .map((childPath) => OpenDirectory(childPath));

    await Promise.all(openSubDirectoriesPromises);

    if (returnChildren) {
        return childrenElements;
    }
}

function filterFilesAndDirectories(fileTreeItem: FileTreeItem) {
    return (
        !fileTreeItem.name.startsWith(".build") &&
        !fileTreeItem.name.startsWith(".git")
    );
}

function sortFilesAndDirectories(a: FileTreeItem, b: FileTreeItem) {
    if (a.type === "directory" && b.type === "file") {
        return -1;
    } else if (a.type === "file" && b.type === "directory") {
        return 1;
    }

    return a.name.toUpperCase() < b.name.toUpperCase() ? -1 : 1;
}

function createFileTreeElement(opts: {
    path: string;
    name: string;
    isDirectory: boolean;
}) {
    const element = createElement("li");

    const elementName = document.createElement("div");
    elementName.classList.add("name-and-options");
    element.append(elementName);

    const nameContainer = document.createElement("div");
    nameContainer.classList.add("name");
    nameContainer.innerHTML = `<span>${opts.name}</span>`;
    elementName.append(nameContainer);

    if (opts.isDirectory) {
        const icon = Icon("Caret");
        nameContainer.prepend(icon);
    }

    const optionsButton = Button({
        style: "icon-small",
        iconLeft: "Options"
    });
    optionsButton.onclick = (e) => {
        e.stopPropagation();
        fileTreeItemOptions(opts.path, optionsButton);
    };
    elementName.append(optionsButton);

    return {
        element,
        elementName
    };
}

function ToggleDirectory(fileTreeItemDirectoryPath: string) {
    const fileTreeItem = tree.get(fileTreeItemDirectoryPath);

    // undiscovered directory
    if (!fileTreeItem) {
        return;
    } else if (fileTreeItem.type === "file") {
        return;
    }

    const fileTreeItemDirectory = fileTreeItem as FileTreeItemDirectory;

    if (fileTreeItemDirectory.childrenList) {
        if (fileTreeItemDirectoryPath !== activeItemPath) return;
        fileTreeItemDirectory.element.classList.remove("opened");
        fileTreeItemDirectory.childrenList.remove();
        fileTreeItemDirectory.childrenList = null;
        openedFileTreeItemDirectoryPath.delete(fileTreeItemDirectoryPath);
    } else {
        OpenDirectory(fileTreeItemDirectoryPath);
    }
}

function setActiveItem(fileTreeItemPath: string) {
    if (activeItemPath) {
        const lastActiveFileTreeItem = tree.get(activeItemPath);
        lastActiveFileTreeItem?.element?.classList.remove("active");
        activeItemPath = null;
    }

    const fileTreeItem = tree.get(fileTreeItemPath);

    // undiscovered item
    if (!fileTreeItem) {
        return;
    }

    fileTreeItem.element.classList.add("active");
    activeItemPath = fileTreeItemPath;
}

function fileTreeItemOptions(
    fileTreeItemPath: string,
    optionsButton: HTMLButtonElement
) {
    const fileTreeItem = tree.get(fileTreeItemPath);

    const renameButton = Button({
        text: "Rename",
        iconLeft: "Edit"
    });

    renameButton.onclick = () => {
        fileTreeItemForm(fileTreeItemPath);
    };

    const deleteButton = Button({
        text: "Delete",
        iconLeft: "Trash",
        color: "red"
    });

    deleteButton.onclick = async () => {
        if (fileTreeItem.type === "file") {
            await ipcEditor.fs.unlink(fileTreeItemPath);
            Store.editor.codeEditor.closeFile(fileTreeItemPath);
        } else {
            await ipcEditor.fs.rmdir(fileTreeItemPath);
            Store.editor.codeEditor.closeFilesUnderDirectory(fileTreeItemPath);
        }
        OpenDirectory(fileTreeItem.parent);
    };

    const parentFileTreeItem = tree.get(
        fileTreeItem.parent
    ) as FileTreeItemDirectory;
    const isRootList = parentFileTreeItem.parent === "";
    const parentChildrenList = Array.from(
        parentFileTreeItem.childrenList.children
    );
    let shouldDisplayOptionsReversed = false;
    if (isRootList && parentChildrenList.length > 4) {
        const indexOf = parentChildrenList.indexOf(fileTreeItem.element);
        shouldDisplayOptionsReversed = parentChildrenList.length - indexOf <= 2;
    }

    Popover({
        anchor: optionsButton,
        content: ButtonGroup(
            shouldDisplayOptionsReversed
                ? [deleteButton, renameButton]
                : [renameButton, deleteButton]
        ),
        align: {
            y: shouldDisplayOptionsReversed ? "bottom" : "top",
            x: "right"
        }
    });
}

function fileTreeItemForm(fileTreeItemPath: string) {
    const fileTreeItem = tree.get(fileTreeItemPath);

    // undiscovered item
    if (!fileTreeItem) {
        return;
    }

    const form = document.createElement("form");
    const inputName = InputText();
    inputName.input.value = fileTreeItem.name;
    inputName.input.onclick = (e) => e.stopPropagation();

    if (fileTreeItem.type === "directory") {
        form.append(Icon("Caret"));
    }

    form.append(inputName.container);

    const submit = async () => {
        form.replaceWith(fileTreeItem.elementName);

        const newPath = fileTreeItem.parent + "/" + inputName.input.value;

        if (newPath === fileTreeItemPath) {
            return;
        }

        if (fileTreeItem.type === "file") {
            await ipcEditor.fs.rename(fileTreeItemPath, newPath);
            tree.delete(fileTreeItemPath);
            Store.editor.codeEditor.closeFile(fileTreeItemPath);
        } else if (fileTreeItem.type === "directory") {
            await ipcEditor.fs.rename(fileTreeItemPath, newPath);
            Store.editor.codeEditor.closeFilesUnderDirectory(fileTreeItemPath);
        }

        OpenDirectory(fileTreeItem.parent);
    };

    inputName.input.onblur = submit;

    form.onsubmit = (e) => {
        e.preventDefault();
        submit();
    };

    fileTreeItem.elementName.replaceWith(form);

    const dotIndex = inputName.input.value.lastIndexOf(".");
    setTimeout(() => {
        inputName.input.focus();

        if (inputName.input.value) {
            inputName.input.setSelectionRange(
                0,
                dotIndex === -1 ? inputName.input.value.length : dotIndex
            );
        }
    }, 1);
}

async function newFileItemForm(project: Project, forDirectory: boolean) {
    const itemElement = document.createElement("li");

    const form = document.createElement("form");
    const inputName = InputText();
    inputName.input.onclick = (e) => e.stopPropagation();

    if (forDirectory) {
        form.append(Icon("Caret"));
    }

    form.append(inputName.container);

    itemElement.append(form);

    const submit = async () => {
        const value = inputName.input.value;

        if (!value) {
            itemElement.remove();
            return;
        }

        const parentPath =
            (parent.parent ? parent.parent + "/" : "") + parent.name;
        const path = parentPath + "/" + value;

        if (forDirectory) {
            await ipcEditor.fs.mkdir(path);
        } else {
            await ipcEditor.fs.writeFile(path, "\n");
        }

        itemElement.remove();

        OpenDirectory(parentPath);
    };

    inputName.input.onblur = submit;

    form.onsubmit = (e) => {
        e.preventDefault();
        submit();
    };

    let parent: FileTreeItemDirectory;
    if (activeItemPath) {
        const activeFileTreeItem = tree.get(activeItemPath);

        if (activeFileTreeItem) {
            if (activeFileTreeItem.type === "directory") {
                if (!activeFileTreeItem.childrenList) {
                    await OpenDirectory(activeItemPath);
                }

                parent = activeFileTreeItem;
            } else if (activeFileTreeItem.type === "file") {
                const activeFileTreeItemParent = tree.get(
                    activeFileTreeItem.parent
                ) as FileTreeItemDirectory;

                if (!activeFileTreeItemParent.childrenList) {
                    await OpenDirectory(activeFileTreeItem.parent);
                }

                parent = activeFileTreeItemParent;
            }
        }
    }

    if (!parent) {
        parent = tree.get(project.id) as FileTreeItemDirectory;
    }

    parent.childrenList.append(itemElement);

    setTimeout(() => {
        inputName.input.focus();
    }, 1);
}
