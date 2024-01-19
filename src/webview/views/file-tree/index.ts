import "./index.scss";
import { rpc } from "../../rpc";
import type { api } from "../../../api";

export class FileTree {
    filters: ((item: ReturnType<typeof api.fs.readdir>[0]) => boolean)[] = [];
    private showHiddenFile = false;

    private async openDirectory(pathComponents: string[]) {
        const ul = document.createElement("ul");

        (await rpc().fs.readdir(pathComponents.join("/")))
            .filter(item => {
                if(!this.showHiddenFile && item.name.startsWith("."))
                    return false;

                for (const filter of this.filters) {
                    if(!filter(item))
                        return false;
                }

                return true;
            })
            .forEach(({name, isDirectory}) => {
                const li = document.createElement("li")
                li.innerText = `${isDirectory ? "▶" : ""} ${name}`;
    
                li.addEventListener("click", async (e) => {
                    e.stopPropagation();
    
                    if(isDirectory) {
                        const expand = !(li.getAttribute("aria-expanded") === "true")
                        li.innerText = `${expand ? "▼ " : "▶ "}${name}`;
        
                        if(expand){
                            li.append(await this.openDirectory([...pathComponents, name]));
                        }
                        else {
                            li.querySelector("ul")?.remove();
                        }
        
                        li.setAttribute("aria-expanded", expand.toString());
                    }
                    else {
                        
                    }
                })
    
                ul.append(li);
            });

        return ul;
    }

    async render(){
        const container = document.createElement("div");
        container.classList.add("file-tree-view");

        const actionsContainer = document.createElement("div");

        const hiddenFileCheckboxLabel = document.createElement("label");
        hiddenFileCheckboxLabel.innerText = "Hidden Files";
        actionsContainer.append(hiddenFileCheckboxLabel)

        const hiddenFileCheckbox = document.createElement("input")
        hiddenFileCheckbox.type = "checkbox";
        actionsContainer.appendChild(hiddenFileCheckbox);

        const newDirectoryButton = document.createElement("button");
        newDirectoryButton.classList.add("small");
        newDirectoryButton.innerText = "New Directory";
        actionsContainer.append(newDirectoryButton);

        container.append(actionsContainer);


        // tree
        const ulRoot = await this.openDirectory([]);
        ulRoot.classList.add("file-tree");
        container.append(ulRoot)

        return container;
    }
}