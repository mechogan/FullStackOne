import type { Dirent } from "../../../../src/adapter/fs";
import { Popover } from "../../../components/popover";
import { Button, ButtonGroup } from "../../../components/primitives/button";
import { Icon } from "../../../components/primitives/icon";
import { InputText } from "../../../components/primitives/inputs";
import rpc from "../../../rpc";
import { WorkerTS } from "../../../typescript";
import { CodeEditor } from "./code-editor";

let openedDirectory = new Set<string>();
let activeItem: {
    path: string;
    isDirectory?: boolean;
    open?: () => void;
    el?: HTMLLIElement;
};

type FileTreeOpts = {
    directory: string;
    onClosePanel: () => void;
};

export function FileTree(opts: FileTreeOpts) {
    openedDirectory.clear();
    activeItem = null;

    const container = document.createElement("div");
    container.classList.add("file-tree");

    const topActions = document.createElement("div");

    const left = document.createElement("div");
    const toggleWidth = Button({
        style: "icon-small",
        iconLeft: "Side Panel"
    });
    toggleWidth.onclick = opts.onClosePanel;
    left.append(toggleWidth);

    const reloadFileTree = () => {
        WorkerTS.call().invalidateWorkingDirectory();

        const updatedTreeRoot = TreeRecursive({
            directory: opts.directory,
            didDeleteOrRenameItem: reloadFileTree
        });
        if (treeRoot) {
            treeRoot.replaceWith(updatedTreeRoot);
        }
        treeRoot = updatedTreeRoot;
    };

    const treeContainer = document.createElement("div");
    let treeRoot: ReturnType<typeof TreeRecursive>;
    reloadFileTree();
    treeContainer.append(treeRoot);

    const right = document.createElement("div");
    const newFileButton = Button({
        style: "icon-small",
        iconLeft: "File Add"
    });
    newFileButton.onclick = () =>
        AddFile({
            baseDirectory: opts.directory,
            treeRoot,
            didCreateItem: reloadFileTree
        });

    const newDirectoryButton = Button({
        style: "icon-small",
        iconLeft: "Directory Add"
    });
    newDirectoryButton.onclick = () =>
        AddDirectory({
            baseDirectory: opts.directory,
            treeRoot,
            didCreateItem: reloadFileTree
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

        const data = new Uint8Array(await file.arrayBuffer());

        const directory = activeItem
            ? activeItem.isDirectory
                ? activeItem.path
                : activeItem.path.split("/").slice(0, -1).join("/")
            : opts.directory;

        rpc()
            .fs.writeFile(`${directory}/${file.name}`, data, {
                absolutePath: true
            })
            .then(() => reloadFileTree());

        form.reset();
    };

    form.append(fileInput);
    uploadButton.append(form);

    uploadButton.onclick = () => fileInput.click();

    right.append(newFileButton, newDirectoryButton, uploadButton);

    topActions.append(left, right);

    container.append(topActions, treeContainer);

    return { container, reloadFileTree };
}

type TreeRecursiveOpts = {
    directory: string;
    didDeleteOrRenameItem: () => void;
};

function TreeRecursive(opts: TreeRecursiveOpts) {
    const container = document.createElement("ul");

    rpc()
        .fs.readdir(opts.directory, {
            absolutePath: true,
            withFileTypes: true
        })
        .then((contents: Dirent[]) => {
            const items = contents
                .filter(({ name }) => !name.startsWith("."))
                .sort((a, b) => {
                    const isDirectoryA =
                        typeof a.isDirectory === "function"
                            ? a.isDirectory()
                            : a.isDirectory;
                    const isDirectoryB =
                        typeof b.isDirectory === "function"
                            ? b.isDirectory()
                            : b.isDirectory;

                    if (isDirectoryA && !isDirectoryB) {
                        return -1;
                    } else if (!isDirectoryA && isDirectoryB) {
                        return 1;
                    }

                    return a.name.toUpperCase() < b.name.toUpperCase() ? -1 : 1;
                })
                .map((dirent) =>
                    Item({
                        directory: opts.directory,
                        dirent,
                        didDeleteOrRename: opts.didDeleteOrRenameItem
                    })
                );

            container.append(...items);
        });

    return container;
}

type ItemOpts = {
    directory: string;
    dirent: Dirent;
    didDeleteOrRename: () => void;
};

function Item(opts: ItemOpts) {
    const path = opts.directory + "/" + opts.dirent.name;
    const item = document.createElement("li");

    const nameAndOptions = document.createElement("div");
    nameAndOptions.classList.add("name-and-options");
    item.append(nameAndOptions);

    const nameContainer = document.createElement("div");
    nameContainer.classList.add("name");
    nameContainer.innerHTML = `<span>${opts.dirent.name}</span>`;
    nameAndOptions.append(nameContainer);

    const isDirectory =
        typeof opts.dirent.isDirectory === "function"
            ? opts.dirent.isDirectory()
            : opts.dirent.isDirectory;

    let children: HTMLUListElement;
    const openDirectory = () => {
        item.classList.add("opened");
        children = TreeRecursive({
            directory: path,
            didDeleteOrRenameItem: opts.didDeleteOrRename
        });
        item.append(children);
        openedDirectory.add(path);
    };

    if (isDirectory) {
        const icon = Icon("Caret");
        nameContainer.prepend(icon);

        if (openedDirectory.has(path)) {
            openDirectory();
        }
    }

    const setActive = () => {
        activeItem?.el?.classList?.remove("active");
        activeItem = {
            path,
            isDirectory,
            open: isDirectory ? openDirectory : null,
            el: item
        };
        item.classList.add("active");
    };

    nameAndOptions.onclick = () => {
        if (isDirectory) {
            if (children) {
                if (activeItem?.path === path) {
                    item.classList.remove("opened");
                    children.remove();
                    children = null;
                    openedDirectory.delete(path);
                }
            } else {
                openDirectory();
            }
        } else {
            CodeEditor.addFile(path);
        }

        setActive();
    };

    const options = Button({
        style: "icon-small",
        iconLeft: "Options"
    });

    options.onclick = (e) => {
        e.stopPropagation();

        const renameButton = Button({
            text: "Rename",
            iconLeft: "Edit"
        });
        renameButton.onclick = () => {
            const form = ItemInputForm({
                initialValue: opts.dirent.name,
                directory: opts.directory,
                forDirectory: isDirectory,
                didSubmit: async (directory, name) => {
                    if (!name) return;
                    const newPath = directory + "/" + name;

                    let pathToReplace = [
                        {
                            oldPath: path,
                            newPath: newPath
                        }
                    ];
                    if (isDirectory) {
                        const directoryContent = (await rpc().fs.readdir(path, {
                            recursive: true,
                            absolutePath: true
                        })) as string[];
                        pathToReplace = directoryContent.map((item) => ({
                            oldPath: `${path}/${item}`,
                            newPath: `${newPath}/${item}`
                        }));
                    }

                    if (activeItem.path === path) {
                        activeItem = {
                            path: newPath
                        };
                    }

                    rpc()
                        .fs.rename(path, newPath, { absolutePath: true })
                        .then(() => {
                            opts.didDeleteOrRename();
                            pathToReplace.forEach(({ oldPath, newPath }) => {
                                CodeEditor.replacePath(oldPath, newPath);
                            });
                        });
                }
            });

            nameAndOptions.replaceWith(form);
            // setTimeout(() => , 1);
        };

        const deleteButton = Button({
            text: "Delete",
            iconLeft: "Trash",
            color: "red"
        });
        deleteButton.onclick = () => {
            if (activeItem.path === path) {
                activeItem = null;
            }

            if (isDirectory) {
                rpc()
                    .fs.readdir(path, { recursive: true, absolutePath: true })
                    .then((files: string[]) => {
                        files.forEach((file) => {
                            CodeEditor.remove(`${path}/${file}`);
                        });

                        rpc()
                            .fs.rmdir(path, { absolutePath: true })
                            .then(opts.didDeleteOrRename);
                    });
            } else {
                CodeEditor.remove(path, true);
                rpc()
                    .fs.unlink(path, { absolutePath: true })
                    .then(opts.didDeleteOrRename);
            }
        };

        const parentList = item.parentElement;
        const isRootList = parentList.parentElement.tagName === "DIV";
        let shouldDisplayOptionsReversed = false;
        if (isRootList && parentList.children.length > 4) {
            const indexOf = Array.from(parentList.children).indexOf(item);
            shouldDisplayOptionsReversed =
                parentList.children.length - indexOf <= 2;
        }

        Popover({
            anchor: options,
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
    };

    nameAndOptions.append(options);

    if (activeItem?.path === path) {
        setActive();
    }

    return item;
}

type ItemInputFormOpts = {
    initialValue: string;
    forDirectory: boolean;
    directory: string;
    didSubmit: (directory: string, name: string) => void;
};

function ItemInputForm(opts: ItemInputFormOpts) {
    const form = document.createElement("form");

    const inputName = InputText();
    inputName.input.onblur = () => form.onsubmit(null);
    inputName.input.value = opts.initialValue;

    if (opts.forDirectory) {
        form.append(Icon("Caret"));
    }

    form.append(inputName.container);

    let didSubmit = false;
    form.onsubmit = (e) => {
        e?.preventDefault();

        if (didSubmit) return;
        didSubmit = true;

        const name = inputName.input.value;
        opts.didSubmit(opts.directory, name);
    };

    const dotIndex = opts.initialValue.lastIndexOf(".");

    setTimeout(() => {
        inputName.input.focus();
        inputName.input.setSelectionRange(
            0,
            dotIndex === -1 ? opts.initialValue.length : dotIndex
        );
    }, 1);

    return form;
}

type NewItemFormOpts = {
    baseDirectory: string;
    treeRoot: HTMLElement;
    forDirectory: boolean;
    didSubmit: (directory: string, name: string) => void;
};

function NewItemForm(opts: NewItemFormOpts) {
    const item = document.createElement("li");

    let ul = opts.treeRoot;
    let directory = opts.baseDirectory;

    if (activeItem) {
        if (activeItem.isDirectory) {
            if (!openedDirectory.has(activeItem.path)) {
                activeItem.open();
            }

            ul = activeItem.el.querySelector("ul");
            directory = activeItem.path;
        } else {
            ul = activeItem.el.parentElement;
            directory = activeItem.path.split("/").slice(0, -1).join("/");
        }
    }

    const form = ItemInputForm({
        ...opts,
        initialValue: "",
        directory,
        didSubmit: (directory, name) => {
            item.remove();
            if (!name) return;
            opts.didSubmit(directory, name);
        }
    });

    item.append(form);
    ul.append(item);

    return form;
}

type AddFileOrDirectoryOpts = {
    baseDirectory: string;
    treeRoot: HTMLElement;
    didCreateItem: () => void;
};

function AddFile(opts: AddFileOrDirectoryOpts) {
    NewItemForm({
        ...opts,
        forDirectory: false,
        didSubmit: (directory, name) => {
            const path = directory + "/" + name;

            activeItem = {
                path
            };

            rpc()
                .fs.writeFile(directory + "/" + name, "\n", {
                    absolutePath: true
                })
                .then(() => {
                    opts.didCreateItem();
                    CodeEditor.addFile(path);
                });
        }
    });
}

function AddDirectory(opts: AddFileOrDirectoryOpts) {
    NewItemForm({
        ...opts,
        forDirectory: true,
        didSubmit: (directory, name) => {
            const path = directory + "/" + name;

            activeItem = {
                path
            };

            rpc()
                .fs.mkdir(directory + "/" + name, { absolutePath: true })
                .then(() => {
                    openedDirectory.add(path);
                    opts.didCreateItem();
                });
        }
    });
}
