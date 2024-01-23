
import "./index.scss";
import { Editor } from '../editor';
import { FileTree } from '../file-tree';
import arrowLeft from "../../assets/icons/arrow-left.svg";
import sidePanel from "../../assets/icons/side-panel.svg";
import type { Project as TypeProject } from "../../../api/projects/types";
import { rpc } from "../../rpc";
import Run from "../../assets/icons/run.svg";

export class Project {
    backAction: () => void;

    private container: HTMLDivElement;
    private project: TypeProject;

    editor = new Editor();
    fileTree = new FileTree();

    private currentFile: string | null;
    private onTextChangeThrottler: ReturnType<typeof setTimeout> | null;

    async onEditorTextChange(value: string){
        this.onTextChangeThrottler = null;
        if(!value) 
            return;

        if (!this.currentFile)
            this.currentFile = this.project.location + "/new-file.js";

        await rpc().fs.putfile(this.currentFile, value);
    }

    setProject(project: TypeProject) {
        this.currentFile = null;

        this.project = project;
        this.fileTree.setBaseDirectory(project.location);

        this.editor.onTextChange = (value: string) => {
            if(this.onTextChangeThrottler)
                clearTimeout(this.onTextChangeThrottler);

            this.onTextChangeThrottler = setTimeout(() => this.onEditorTextChange(value), 2000);
        };
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

    async render() {
        this.container = document.createElement("div");
        this.container.classList.add("project");

        this.container.append(this.renderToolbar());
        this.container.append(await this.fileTree.render());
        this.container.append(this.editor.render());

        return this.container;
    }
}