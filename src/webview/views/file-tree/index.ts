import "./index.scss";
import { rpc } from "../../rpc";
import type { api } from "../../../api";
import AddDirectory from "../../assets/icons/add-directory.svg"
import AddFile from "../../assets/icons/add-file.svg"

export class FileTree {
    filters: ((item: ReturnType<typeof api.fs.readdir>[0]) => boolean)[] = [];
    private showHiddenFile = false;

    private ulRoot: HTMLUListElement;
    private baseDirectory: string[] = [];

    selectedItem: {
        element: HTMLLIElement,
        path: string[],
        isDirectory: boolean
    } | undefined;

    setBaseDirectory(path: string) {
        this.baseDirectory = path.split("/");
    }

    private async openDirectory(pathComponents: string[]) {
        const ul = document.createElement("ul");

        (await rpc().fs.readdir(pathComponents.join("/")))
            .filter(item => {
                if (!this.showHiddenFile && item.name.startsWith("."))
                    return false;

                for (const filter of this.filters) {
                    if (!filter(item))
                        return false;
                }

                return true;
            })
            .forEach(({ name, isDirectory }) => {
                const li = document.createElement("li")
                li.innerText = `${isDirectory ? "▶" : ""} ${name}`;

                li.addEventListener("click", async (e) => {
                    e.stopPropagation();

                    const itemPathComponents = [...pathComponents, name];

                    if (this.selectedItem) {
                        this.selectedItem.element.removeAttribute("aria-selected");
                        this.selectedItem.element.classList.remove("selected");
                    }

                    this.selectedItem = {
                        element: li,
                        path: itemPathComponents,
                        isDirectory: !!isDirectory
                    };

                    li.setAttribute("aria-selected", "true");
                    li.classList.add("selected");

                    if (isDirectory) {
                        const expand = !(li.getAttribute("aria-expanded") === "true")
                        li.innerText = `${expand ? "▼ " : "▶ "}${name}`;

                        if (expand) {
                            li.append(await this.openDirectory(itemPathComponents));
                        }
                        else {
                            li.querySelector("ul")?.remove();
                        }

                        li.setAttribute("aria-expanded", expand.toString());
                    }
                })

                ul.append(li);
            });

        return ul;
    }

    private createInputAtSelectedLocation() {
        let selectedUl = this.selectedItem
            ? this.selectedItem.isDirectory
                ? this.selectedItem.element.querySelector(":scope > ul")
                : this.selectedItem.element.parentElement
            : this.ulRoot;

        const newLi = document.createElement("li");
        const newNameInput = document.createElement("input");
        newNameInput.autocapitalize = "off";
        newLi.append(newNameInput);
        selectedUl?.append(newLi);

        return {
            ul: selectedUl,
            li: newLi,
            input: newNameInput,
        };
    }

    private mkdir() {
        const { ul, li, input } = this.createInputAtSelectedLocation();

        li.prepend("▶ ")

        const mkDir = async () => {
            const newDirectoryName = input.value;

            li.remove();

            if (!newDirectoryName)
                return;

            const parentDirectoryPathComponents = this.selectedItem
                ? this.selectedItem.isDirectory
                    ? this.selectedItem.path
                    : this.selectedItem.path.slice(0, -1)
                : this.baseDirectory;

            await rpc().fs.mkdir(parentDirectoryPathComponents.join("/") + "/" + newDirectoryName);

            const updatedChildrenList = await this.openDirectory(parentDirectoryPathComponents);

            if (ul === this.ulRoot) {
                updatedChildrenList.classList.add("file-tree");
            }

            ul?.replaceWith(updatedChildrenList);
        }

        input.addEventListener("keydown", async e => {
            const key = e.key;
            if (key !== "Enter")
                return;

            mkDir();
        });
        input.addEventListener("blur", () => {
            mkDir();
        })

        input.focus();
    }

    private touch() {
        const { ul, li, input } = this.createInputAtSelectedLocation();

        const touch = async () => {
            const newFileName = input.value;

            li.remove();

            if (!newFileName)
                return;

            const parentDirectoryPathComponents = this.selectedItem
                ? this.selectedItem.isDirectory
                    ? this.selectedItem.path
                    : this.selectedItem.path.slice(0, -1)
                : this.baseDirectory;

            await rpc().fs.putfile(parentDirectoryPathComponents.join("/") + "/" + newFileName, "\n");

            const updatedChildrenList = await this.openDirectory(parentDirectoryPathComponents);

            if (ul === this.ulRoot) {
                updatedChildrenList.classList.add("file-tree");
            }

            ul?.replaceWith(updatedChildrenList);
        }

        input.addEventListener("keydown", async e => {
            const key = e.key;
            if (key !== "Enter")
                return;

            touch();
        });
        input.addEventListener("blur", () => {
            touch();
        })

        input.focus();
    }

    async render() {
        const container = document.createElement("div");
        container.classList.add("file-tree-view");
        container.addEventListener("click", () => {
            if (this.selectedItem) {
                this.selectedItem.element.removeAttribute("aria-selected");
                this.selectedItem.element.classList.remove("selected");
            }

            this.selectedItem = undefined;
        })

        this.ulRoot = await this.openDirectory(this.baseDirectory);
        this.ulRoot.classList.add("file-tree");

        const actionsContainer = document.createElement("div");

        // const hiddenFileCheckboxLabel = document.createElement("label");
        // hiddenFileCheckboxLabel.innerText = "Hidden Files";
        // actionsContainer.append(hiddenFileCheckboxLabel);

        // const hiddenFileCheckbox = document.createElement("input")
        // hiddenFileCheckbox.type = "checkbox";
        // actionsContainer.appendChild(hiddenFileCheckbox);

        const newDirectoryButton = document.createElement("button");
        newDirectoryButton.classList.add("small", "text");
        newDirectoryButton.innerHTML = AddDirectory;
        newDirectoryButton.addEventListener("click", e => {
            e.stopPropagation();
            this.mkdir();
        });
        actionsContainer.append(newDirectoryButton);

        const newFileButton = document.createElement("button");
        newFileButton.classList.add("small", "text");
        newFileButton.innerHTML = AddFile;
        newFileButton.addEventListener("click", e => {
            e.stopPropagation();
            this.touch();
        });
        actionsContainer.append(newFileButton);

        container.append(actionsContainer);

        container.append(this.ulRoot)

        return container;
    }
}