import "./index.scss";
import { rpc } from "../../rpc";
import type { api } from "../../../api";

export class FileTree {
    filters: ((item: ReturnType<typeof api.fs.readdir>[0]) => boolean)[] = [];
    private showHiddenFile = false;

    selectedItem: {
        element: HTMLLIElement,
        path: string[],
        isDirectory: boolean
    } | undefined;

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

                    if(this.selectedItem){
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

    async render() {
        const container = document.createElement("div");
        container.classList.add("file-tree-view");
        container.addEventListener("click", () => {
            if(this.selectedItem){
                this.selectedItem.element.removeAttribute("aria-selected");
                this.selectedItem.element.classList.remove("selected");
            }

            this.selectedItem = undefined;
        })

        const ulRoot = await this.openDirectory([]);
        ulRoot.classList.add("file-tree");

        const actionsContainer = document.createElement("div");

        const hiddenFileCheckboxLabel = document.createElement("label");
        hiddenFileCheckboxLabel.innerText = "Hidden Files";
        actionsContainer.append(hiddenFileCheckboxLabel);

        const hiddenFileCheckbox = document.createElement("input")
        hiddenFileCheckbox.type = "checkbox";
        actionsContainer.appendChild(hiddenFileCheckbox);

        const newDirectoryButton = document.createElement("button");
        newDirectoryButton.classList.add("small");
        newDirectoryButton.innerText = "New Directory";
        newDirectoryButton.addEventListener("click", e => {
            e.stopPropagation();

            let selectedUl = this.selectedItem 
                ? this.selectedItem.element.querySelector(":scope > ul")
                : ulRoot;

            const newDirectoryLi = document.createElement("li");
            const newDirectoryNameInput = document.createElement("input");
            newDirectoryLi.append(newDirectoryNameInput);
            selectedUl?.append(newDirectoryLi);

            newDirectoryNameInput.addEventListener("keydown", async e => {
                const key = e.key;
                if(key !== "Enter")
                    return;

                const newDirectoryName = newDirectoryNameInput.value;

                newDirectoryLi.remove();

                const parentDirectoryPathComponents = this.selectedItem
                    ? this.selectedItem.isDirectory
                        ? this.selectedItem.path
                        : this.selectedItem.path.slice(0, -1)
                    : [];

                await rpc().fs.mkdir(parentDirectoryPathComponents.join("/") + "/" + newDirectoryName);

                const updatedChildrenList = await this.openDirectory(parentDirectoryPathComponents);

                if(selectedUl === ulRoot) {
                    updatedChildrenList.classList.add("file-tree");
                }

                selectedUl?.replaceWith(updatedChildrenList);
            });

            newDirectoryNameInput.focus();
        });
        actionsContainer.append(newDirectoryButton);

        container.append(actionsContainer);

        
        container.append(ulRoot)

        return container;
    }
}