import { createFileTree } from "@fullstacked/file-tree";
import { Project } from "../../types";
import { createElement } from "../../components/element";
import fs from "../../../lib/fs";
import { Button, ButtonGroup } from "../../components/primitives/button";
import { NEW_FILE_ID } from "../../constants";
import { Store } from "../../store";
import { Icon } from "../../components/primitives/icon";
import { Popover } from "../../components/popover";
import core_message from "../../../lib/core_message";

enum FileEventType {
    UNKNOWN = 0,
    CREATED = 1,
    MODIFIED = 2,
    RENAME = 3,
    DELETED = 4
}

type FileEvent = {
    isFile: boolean;
    origin: string;
    paths: string[];
    type: FileEventType;
};

const directoryIconOpen = Icon("Caret");
directoryIconOpen.classList.add("open");
const directoryIconClose = Icon("Caret");

const hide = ["/.build", "/.git"];

export function FileTree(project: Project) {
    const container = createElement("div");
    container.classList.add("file-tree-container");

    container.append(TopActions(project));

    const fileTree = createFileTree({
        readDirectory: async (path: string) => {
            const content = await fs.readdir(project.id + "/" + path, {
                withFileTypes: true
            });
            return content.filter((i) => !hide.includes(path + "/" + i.name));
        },
        isDirectory: async (path: string) =>
            !(await fs.exists(project.id + "/" + path))?.isFile,
        indentWidth: 15,
        directoryIcons: {
            open: directoryIconOpen,
            close: directoryIconClose
        },
        prefix: (path) => {
            const div = document.createElement("div");
            div.classList.add("dev-icon");

            const devIconClass = pathToDevIconClass(path);
            if (devIconClass) {
                div.classList.add(devIconClass);
            }

            return div;
        },
        suffix: (path) => {
            const button = Button({
                style: "icon-small",
                iconLeft: "Options"
            });

            button.onclick = (e) => {
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

                deleteButton.onclick = () => {
                    const pathAbs = project.id + "/" + path;
                    fs.exists(pathAbs).then((exists) => {
                        if (!exists) return;

                        if (exists.isFile) {
                            fs.unlink(pathAbs);
                        } else {
                            fs.rmdir(pathAbs);
                        }
                    });
                };

                const buttonGroup = ButtonGroup([renameButton, deleteButton]);

                Popover({
                    anchor: button,
                    content: buttonGroup,
                    align: {
                        x: "left",
                        y: "top"
                    }
                });
            };

            return button;
        },
        onSelect: (path) => {
            const pathAbs = project.id + "/" + path;
            fs.exists(pathAbs).then((exists) => {
                if (!exists?.isFile) return;
                Store.editor.codeEditor.openFile(pathAbs);
                Store.editor.codeEditor.focusFile(pathAbs);
            });
        }
    });
    container.append(fileTree.container);

    const pathAbsToRelative = (p: string) => {
        const pathComponents = p.split(project.id + "/");
        if (pathComponents.length !== 2) {
            return null;
        }
        return pathComponents.at(-1);
    };

    const onFileEvents = (e: string) => {
        const fileEvents = (JSON.parse(e) as FileEvent[])
            .map((e) => {
                e.paths = e.paths.map(pathAbsToRelative);
                return e;
            })
            .filter(
                (e) =>
                    !e.paths.some(
                        (p) =>
                            p === null ||
                            hide.find((h) => p.startsWith("/" + h))
                    )
            );

        for (const event of fileEvents) {
            switch (event.type) {
                case FileEventType.CREATED:
                    fileTree.addItem(event.paths.at(0));
                    break;
                case FileEventType.MODIFIED:
                case FileEventType.RENAME:
                    break;
                case FileEventType.DELETED:
                    fileTree.removeItem(event.paths.at(0));
                    break;
            }
        }
    };

    core_message.addListener("file-event", onFileEvents);
    container.ondestroy = () => {
        core_message.removeListener("file_event", onFileEvents);
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
    newFileButton.onclick = () => {};

    const newDirectoryButton = Button({
        style: "icon-small",
        iconLeft: "Directory Add"
    });
    newDirectoryButton.onclick = () => {};

    const uploadButton = Button({
        style: "icon-small",
        iconLeft: "Upload"
    });
    uploadButton.classList.add("import-file");
    const form = document.createElement("form");
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.onchange = async () => {};
    form.append(fileInput);
    uploadButton.append(form);
    uploadButton.onclick = () => fileInput.click();

    right.append(newFileButton, newDirectoryButton, uploadButton);

    container.append(left, right);

    return container;
}

function pathToDevIconClass(path: string) {
    const ext = path.split(".").pop();
    switch (ext) {
        case "ts":
        case "cts":
        case "mts":
            return "typescript";
        case "js":
        case "cjs":
        case "mjs":
            return "javascript";
        case "tsx":
        case "jsx":
            return "react";
        case "html":
            return "html";
        case "sass":
        case "scss":
            return "sass";
        case "css":
            return "css";
        case "json":
            return "json";
        case "md":
            return "markdown";
        case "liquid":
            return "liquid";
        case "png":
        case "jpg":
        case "jpeg":
            return "image";
        case "svg":
            return "svg";
        case "npmignore":
            return "npm";
        default:
            return "default";
    }
}
