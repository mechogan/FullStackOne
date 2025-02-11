import { createFileTree } from "@fullstacked/file-tree";
import { Project } from "../../types";
import { createElement } from "../../components/element";
import fs from "../../../lib/fs";
import { Button } from "../../components/primitives/button";
import { NEW_FILE_ID } from "../../constants";
import { Store } from "../../store";
import { Icon } from "../../components/primitives/icon";

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
        indentWidth: 15,
        directoryIcons: {
            open: directoryIconOpen,
            close: directoryIconClose
        },
        iconPrefix: ({ path }) => {
            const div = document.createElement("div");
            div.classList.add("dev-icon");

            const devIconClass = pathToDevIconClass(path);
            if (devIconClass) {
                div.classList.add(devIconClass);
            }

            return div;
        }
    });
    container.append(fileTree.container);

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
