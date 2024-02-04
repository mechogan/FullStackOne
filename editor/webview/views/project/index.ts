import "./index.css";

import { Editor } from '../editor';
import { FileTree } from '../file-tree';
import { Console } from "../console";


import type { Project as TypeProject } from "../../../api/projects/types";
import type typeRPC from "../../../../src/webview";
import type api from "../../../api";

declare var rpc: typeof typeRPC<typeof api>;

export class Project {
    backAction: () => void;

    private container: HTMLDivElement;
    private project: TypeProject;

    fileTree = new FileTree();
    console = new Console();

    private editorsContainer = document.createElement("div");

    private currentFile: string;
    private editors: Editor[] = [];

    constructor(){
        this.fileTree.onItemSelect = (item => {
            if(!item || item.isDirectory) 
                return;

            const joinedPath = item.path.join("/");
            if(!this.editors.find(({filePath}) => filePath.join("/") === joinedPath)){
                this.editors.push(new Editor(item.path));
            }

            this.currentFile = joinedPath;

            this.renderEditors();
        });
    }

    setProject(project: TypeProject) {
        if(project === this.project)
            return;

        this.project = project;
        this.fileTree.setBaseDirectory(project.location);
        
        this.editors = [];
        this.renderEditors();
    }

    private async renderToolbar() {
        const container = document.createElement("div");

        const leftSide = document.createElement("div");

        const backButton = document.createElement("button");
        backButton.innerHTML = await (await fetch("/assets/icons/arrow-left.svg")).text();
        backButton.classList.add("text");
        backButton.addEventListener("click", this.backAction);
        leftSide.append(backButton);

        const fileTreeToggle = document.createElement("button");
        fileTreeToggle.innerHTML = await (await fetch("/assets/icons/side-panel.svg")).text();
        fileTreeToggle.classList.add("text");
        fileTreeToggle.addEventListener("click", () => {
            this.container.classList.toggle("side-panel-closed");
        })
        leftSide.append(fileTreeToggle);

        const projectTitle = document.createElement("h3");
        projectTitle.innerText = this.project.title;
        leftSide.append(projectTitle);


        const rightSide = document.createElement("div");

        const consoleToggle = document.createElement("button");
        consoleToggle.classList.add("text");
        consoleToggle.innerHTML = await (await fetch("/assets/icons/console.svg")).text();
        consoleToggle.addEventListener("click", () => {
            this.container.classList.toggle("bottom-panel-opened");
        });
        rightSide.append(consoleToggle);

        const runButton = document.createElement("button");
        runButton.classList.add("text");
        runButton.innerHTML = await (await fetch("/assets/icons/run.svg")).text();
        runButton.addEventListener("click", () => {
            rpc().projects.run(this.project);
        });
        rightSide.append(runButton);

        container.append(leftSide);
        container.append(rightSide);

        return container;
    }

    renderEditors(){
        Array.from(this.editorsContainer.children).forEach(child => child.remove());
        
        const tabsContainer = document.createElement("ul");
        this.editorsContainer.append(tabsContainer);

        this.editors.forEach(async (editor, index) => {
            const tab = document.createElement("li");
            tab.innerText = editor.filePath.at(-1) || "file";
            tab.addEventListener("click", () => {
                this.currentFile = editor.filePath.join("/");
                this.renderEditors();
            })

            const removeBtn = document.createElement("button");
            removeBtn.classList.add("text", "small")
            removeBtn.innerHTML = await (await fetch("/assets/icons/close.svg")).text();
            removeBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.editors.splice(index, 1);
                this.renderEditors();
            })
            tab.append(removeBtn);

            tabsContainer.append(tab);

            if(editor.filePath.join("/") === this.currentFile){
                tab.classList.add("active");
                this.editorsContainer.append(await editor.render());
            }
        });

    }

    async render() {
        this.container = document.createElement("div");
        this.container.classList.add("project");

        this.container.append(await this.renderToolbar());
        this.fileTree.allowDeletion = true;
        this.container.append(await this.fileTree.render());
        this.container.append(this.editorsContainer);
        this.container.append(this.console.render());

        return this.container;
    }
}