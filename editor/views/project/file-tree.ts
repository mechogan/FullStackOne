import type { Dirent } from "../../../src/adapter/fs";
import { Popover } from "../../components/popover";
import { Button, ButtonGroup } from "../../components/primitives/button";
import { Icon } from "../../components/primitives/icon";
import { InputText } from "../../components/primitives/inputs";
import { NEW_FILE_ID } from "../../constants";
import { ipcEditor } from "../../store/ipc";
import { Project } from "../../types";
import { WorkerTS } from "../../typescript";
import { CodeEditor } from "./code-editor";

let openedDirectory = new Set<string>();
let activeItem: {
    path: string;
    isDirectory?: boolean;
    open?: () => void;
    el?: HTMLLIElement;
};


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
    const toggleWidth = Button({
        style: "icon-small",
        iconLeft: "Side Panel"
    });
    left.append(toggleWidth);

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

        if (inputName.input.value) {
            inputName.input.setSelectionRange(
                0,
                dotIndex === -1 ? opts.initialValue.length : dotIndex
            );
        }
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
