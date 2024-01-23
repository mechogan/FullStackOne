
import "./index.scss";
import { Editor } from '../editor';
import { FileTree } from '../file-tree';
import arrowLeft from "../../assets/icons/arrow-left.svg";
import sidePanel from "../../assets/icons/side-panel.svg";
import type { Project as ProjectType } from "../../../api/projects/types";

export class Project {
    backAction: () => void;

    private project: ProjectType;
    
    editor = new Editor();
    fileTree = new FileTree();


    setProject(project: ProjectType){
        this.project = project;
        this.fileTree.setBaseDirectory(project.location);
    }

    async render() {
        const container = document.createElement("div");
        container.classList.add("project");

        const toolbarContainer = document.createElement("div");

        const backButton = document.createElement("button");
        backButton.innerHTML = arrowLeft;
        backButton.classList.add("text");
        backButton.addEventListener("click", this.backAction);
        toolbarContainer.append(backButton);

        const fileTreeToggle = document.createElement("button");
        fileTreeToggle.innerHTML = sidePanel;
        fileTreeToggle.classList.add("text");
        fileTreeToggle.addEventListener("click", () => {
            container.classList.toggle("side-panel-closed");
        })
        toolbarContainer.append(fileTreeToggle);

        const projectTitle = document.createElement("h3");
        projectTitle.innerText = this.project.title;
        toolbarContainer.append(projectTitle);

        container.append(toolbarContainer);
        container.append(await this.fileTree.render());
        container.append(this.editor.render());

        return container;
    }
}