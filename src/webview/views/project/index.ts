
import "./index.scss";
import { Editor } from '../editor';
import { FileTree } from '../file-tree';
import arrowLeft from "../../assets/icons/arrow-left.svg";
import sidePanel from "../../assets/icons/side-panel.svg";
import type { Project as TypeProject } from "../../../api/projects/types";
import Run from "../../assets/icons/run.svg";
import Close from "../../assets/icons/close.svg";

export class Project {
    backAction: () => void;

    private container: HTMLDivElement;
    private project: TypeProject;

    fileTree = new FileTree();

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

    private renderToolbar() {
        const container = document.createElement("div");

        const leftSide = document.createElement("div");

        const backButton = document.createElement("button");
        backButton.innerHTML = arrowLeft;
        backButton.classList.add("text");
        backButton.addEventListener("click", this.backAction);
        leftSide.append(backButton);

        const fileTreeToggle = document.createElement("button");
        fileTreeToggle.innerHTML = sidePanel;
        fileTreeToggle.classList.add("text");
        fileTreeToggle.addEventListener("click", () => {
            this.container.classList.toggle("side-panel-closed");
        })
        leftSide.append(fileTreeToggle);

        const projectTitle = document.createElement("h3");
        projectTitle.innerText = this.project.title;
        leftSide.append(projectTitle);


        const rightSide = document.createElement("div");

        const runButton = document.createElement("button");
        runButton.classList.add("text");
        runButton.innerHTML = Run;
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
            removeBtn.innerHTML = Close;
            removeBtn.addEventListener("click", e => {
                e.stopPropagation();
                this.editors.splice(index, 1);
                this.renderEditors();
            })
            tab.append(removeBtn);

            tab.append

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

        this.container.append(this.renderToolbar());
        this.fileTree.allowDeletion = true;
        this.container.append(await this.fileTree.render());
        this.container.append(this.editorsContainer);

        return this.container;
    }
}