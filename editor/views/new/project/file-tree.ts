import type { Dirent } from "../../../../src/adapter/fs";
import { Popover } from "../../../components/popover";
import { Button, ButtonGroup } from "../../../components/primitives/button";
import { Icon } from "../../../components/primitives/icon";
import rpc from "../../../rpc";

type FileTreeOpts = {
    directory: string;
    onClosePanel: () => void;
};

export function FileTree(opts: FileTreeOpts) {
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

    const right = document.createElement("div");
    const newFileButton = Button({
        style: "icon-small",
        iconLeft: "File Add"
    });
    const newDirectoryButton = Button({
        style: "icon-small",
        iconLeft: "Directory Add"
    });
    const uploadButton = Button({
        style: "icon-small",
        iconLeft: "Upload"
    });

    right.append(newFileButton, newDirectoryButton, uploadButton);

    topActions.append(left, right);

    container.append(topActions);

    const treeContainer = document.createElement("div");
    treeContainer.append(TreeRecursive(opts.directory));
    container.append(treeContainer);

    return container;
}

let activeItem: HTMLLIElement;

function TreeRecursive(directory: string) {
    const container = document.createElement("ul");

    rpc()
        .fs.readdir(directory, {
            absolutePath: true,
            withFileTypes: true
        })
        .then((contents: Dirent[]) => {
            contents
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
                .forEach(({ name, isDirectory }) => {
                    const item = document.createElement("li");

                    const nameAndOptions = document.createElement("div");
                    nameAndOptions.classList.add("name-and-options");
                    item.append(nameAndOptions);

                    const nameContainer = document.createElement("div");
                    nameContainer.classList.add("name");
                    nameContainer.innerHTML = `<span>${name}</span>`;
                    nameAndOptions.append(nameContainer);

                    isDirectory =
                        typeof isDirectory === "function"
                            ? isDirectory()
                            : isDirectory;

                    if (isDirectory) {
                        const icon = Icon("Caret");
                        nameContainer.prepend(icon);
                    }

                    let children: HTMLUListElement;
                    nameAndOptions.onclick = () => {
                        activeItem?.classList?.remove("active");
                        activeItem = item;
                        item.classList.add("active");

                        if (isDirectory) {
                            if (children) {
                                item.classList.remove("opened");
                                children.remove();
                                children = null;
                            } else {
                                item.classList.add("opened");
                                children = TreeRecursive(
                                    `${directory}/${name}`
                                );
                                item.append(children);
                            }
                        } else {
                        }
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

                        const deleteButton = Button({
                            text: "Delete",
                            iconLeft: "Trash",
                            color: "red"
                        });

                        Popover({
                            anchor: options,
                            content: ButtonGroup([renameButton, deleteButton]),
                            align: {
                                y: "top",
                                x: "right"
                            }
                        });
                    };

                    nameAndOptions.append(options);

                    container.append(item);
                });
        });

    return container;
}
