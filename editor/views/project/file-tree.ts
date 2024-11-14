import { createElement, ElementComponent } from "../../components/element";
import { Button, ButtonGroup } from "../../components/primitives/button";
import { Icon } from "../../components/primitives/icon";
import { NEW_FILE_ID } from "../../constants";
import { Store } from "../../store";
import { ipcEditor } from "../../ipc";
import { Project } from "../../types";
import { Dirent } from "../../../src/fullstacked";
import { Popover } from "../../components/popover";
import { InputText } from "../../components/primitives/inputs";
import { createRefresheable } from "../../components/refresheable";

export function FileTree(project: Project) {
    const container = createElement("div");
    container.classList.add("file-tree");

    const scrollableTree = document.createElement("div");
    const treeRecursive = createRefresheable(TreeRecursive);
    treeRecursive.refresh(project.id);
    scrollableTree.append(treeRecursive.element);

    const topActions = TopActions(project);

    container.append(topActions, scrollableTree);

    let isAddingItem = false;
    const onAddingItemChange = (addingItem: {
        parentDirectory: string;
        isDirectory: boolean;
    }) => {
        if (project.id === addingItem?.parentDirectory) {
            isAddingItem = true;
        } else {
            if (isAddingItem) {
                treeRecursive?.refresh(project.id);
            }
            isAddingItem = false;
        }
    };
    Store.editor.fileTree.addingItem.subscribe(onAddingItemChange);

    container.ondestroy = () => {
        treeRecursive.element.destroy();
        topActions.destroy();
        Store.editor.fileTree.addingItem.unsubscribe(onAddingItemChange);
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
    newFileButton.onclick = () =>
        Store.editor.fileTree.setAddingItem({
            parentDirectory,
            isDirectory: false
        });

    const newDirectoryButton = Button({
        style: "icon-small",
        iconLeft: "Directory Add"
    });
    newDirectoryButton.onclick = () =>
        Store.editor.fileTree.setAddingItem({
            parentDirectory,
            isDirectory: true
        });

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
        if (!file) return;

        

        form.reset();
    };
    form.append(fileInput);
    uploadButton.append(form);
    uploadButton.onclick = () => fileInput.click();

    right.append(newFileButton, newDirectoryButton, uploadButton);

    container.append(left, right);

    let parentDirectory: string;
    const setParentDirectory = (
        activeItem: Dirent & { parentDirectory: string }
    ) => {
        if (!activeItem) {
            parentDirectory = project.id;
            return;
        }

        if (activeItem.isDirectory) {
            parentDirectory =
                activeItem.parentDirectory + "/" + activeItem.name;
        } else {
            parentDirectory = activeItem.parentDirectory;
        }
    };
    Store.editor.fileTree.activeItem.subscribe(setParentDirectory);
    container.ondestroy = () => {
        Store.editor.fileTree.activeItem.unsubscribe(setParentDirectory);
    };

    return container;
}

function TreeRecursive(directory: string) {
    const container = createElement("ul");

    let children: ReturnType<typeof Item>[] = null;
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
        if (addingItemForm) {
            container.append(addingItemForm);
        }
    });

    let addingItemForm: HTMLElement;
    const onAddingItemChange = (addingItem: {
        parentDirectory: string;
        isDirectory: boolean;
    }) => {
        addingItemForm?.remove();

        if (addingItem?.parentDirectory === directory) {
            addingItemForm = createItemForm(addingItem);
            if (children) {
                container.append(addingItemForm);
            }
        }
    };
    Store.editor.fileTree.addingItem.subscribe(onAddingItemChange);

    container.ondestroy = () => {
        children.forEach((e) => e.destroy());
        Store.editor.fileTree.addingItem.unsubscribe(onAddingItemChange);
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
    options.onclick = (e) => {
        e.stopPropagation();
        ItemOptions({
            item,
            element: container
        });
    };
    nameAndOptions.append(options);

    if (item.isDirectory) {
        const icon = Icon("Caret");
        nameContainer.prepend(icon);
    }

    container.append(nameAndOptions);

    let isActive: boolean = false;
    const onActiveItemChange = (
        activeItem: Dirent & { parentDirectory: string }
    ) => {
        const activePath = activeItem?.parentDirectory + "/" + activeItem?.name;

        if (!activeItem || activePath != path) {
            isActive = false;
            container.classList.remove("active");
        } else if (path === activePath) {
            isActive = true;
            container.classList.add("active");
        }
    };

    Store.editor.fileTree.activeItem.subscribe(onActiveItemChange);

    nameAndOptions.onclick = () => {
        if (item.isDirectory && (!children || isActive)) {
            Store.editor.fileTree.toggleDirectory(path);
        } else if (!item.isDirectory) {
            Store.editor.codeEditor.openFile(path);
            Store.editor.codeEditor.focusFile(path);
        }
        Store.editor.fileTree.setActiveItem(item);
    };

    let children: ReturnType<typeof createRefresheable>;
    let onOpenedDirectoryChange = (openedDirectories: Set<string>) => {
        if (openedDirectories.has(path)) {
            container.classList.add("opened");
            if (children) return;
            children = createRefresheable(TreeRecursive);
            children.refresh(path);
            container.append(children.element);
        } else {
            container.classList.remove("opened");
            children?.element.remove();
            children?.element.destroy();
            children = null;
        }
    };
    Store.editor.fileTree.openedDirectories.subscribe(onOpenedDirectoryChange);

    let isAddingItem = false;
    const onAddingItemChange = (addingItem: {
        parentDirectory: string;
        isDirectory: boolean;
    }) => {
        if (!item.isDirectory) return;

        if (path === addingItem?.parentDirectory) {
            isAddingItem = true;
            Store.editor.fileTree.setDirectoryOpen(path, true);
        } else {
            if (isAddingItem) {
                children?.refresh(path);
            }
            isAddingItem = false;
        }
    };
    Store.editor.fileTree.addingItem.subscribe(onAddingItemChange);

    container.ondestroy = () => {
        Store.editor.fileTree.activeItem.unsubscribe(onActiveItemChange);
        Store.editor.fileTree.openedDirectories.unsubscribe(
            onOpenedDirectoryChange
        );
        Store.editor.fileTree.addingItem.unsubscribe(onAddingItemChange);
        children?.element.destroy();
    };

    return container;
}

type ItemOptionsOpts = {
    item: Dirent & { parentDirectory: string };
    element: ElementComponent;
};

function ItemOptions(opts: ItemOptionsOpts) {
    const path = `${opts.item.parentDirectory}/${opts.item.name}`;

    const renameButton = Button({
        text: "Rename",
        iconLeft: "Edit"
    });

    const deleteButton = Button({
        text: "Delete",
        iconLeft: "Trash",
        color: "red"
    });

    deleteButton.onclick = () => {
        if (opts.item.isDirectory) {
            ipcEditor.fs.rmdir(path);
            Store.editor.fileTree.setDirectoryOpen(path, false);
            Store.editor.codeEditor.closeFilesUnderDirectory(path);
        } else {
            ipcEditor.fs.unlink(path);
            Store.editor.codeEditor.closeFile(path);
        }
        opts.element.remove();
    };

    const parentList = opts.element.parentElement;
    const isRootList = parentList.parentElement.tagName === "DIV";
    let shouldDisplayOptionsReversed = false;
    if (isRootList && parentList.children.length > 4) {
        const indexOf = Array.from(parentList.children).indexOf(opts.element);
        shouldDisplayOptionsReversed =
            parentList.children.length - indexOf <= 2;
    }

    Popover({
        anchor: opts.element,
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

function createItemForm(addingItem: {
    parentDirectory: string;
    isDirectory: boolean;
}) {
    const container = document.createElement("li");
    const form = document.createElement("form");

    if (addingItem.isDirectory) {
        form.append(Icon("Caret"));
    }

    const inputFileName = InputText();
    form.append(inputFileName.container);
    container.append(form);

    let submitOnce = false;
    const submit = () => {
        if (submitOnce) return;
        submitOnce = true;

        if (inputFileName.input.value) {
            const path = `${addingItem.parentDirectory}/${inputFileName.input.value}`;
            if (addingItem.isDirectory) {
                ipcEditor.fs.mkdir(path);
            } else {
                ipcEditor.fs.writeFile(path, "\n");
            }
        }

        Store.editor.fileTree.setAddingItem(null);
    };

    inputFileName.input.onblur = () => {
        submit();
    };

    form.onsubmit = (e) => {
        e.preventDefault();
        submit();
    };
    setTimeout(() => inputFileName.input.focus(), 1);
    return container;
}
