import "./index.scss";
import { rpc } from "../../rpc";
import Add from "../../assets/icons/add.svg";
import type { Project } from "../../../api/projects/types";
import Delete from "../../assets/icons/delete.svg";

export class Projects {
    newProjectAction: () => void;
    selectProjectAction: (project: Project) => void;

    private container: HTMLDivElement;

    private renderProjectPreview(project: Project){
        const container = document.createElement("article");

        const projectTitle = document.createElement("h3");
        projectTitle.innerText = project.title;

        container.append(projectTitle);

        container.addEventListener("click", () => {
            this.selectProjectAction(project);
        })

        const deleteButton = document.createElement("button");
        deleteButton.classList.add("text", "danger", "small");
        deleteButton.innerHTML = Delete;
        deleteButton.addEventListener("click", async e => {
            e.stopPropagation();
            await rpc().projects.delete(project);
            this.container.replaceWith(await this.render());
        });
        container.append(deleteButton);

        return container;
    }

    async render() {
        this.container = document.createElement("div");
        this.container.classList.add("projects")

        const title = document.createElement("h1");
        title.innerText = "Projects";
        this.container.append(title);

        const projectsContainer = document.createElement("div");

        const projects = await rpc().projects.list();

        projects
            .sort((projectA, projectB) => projectB.createdDate - projectA.createdDate)
            .forEach(project => {
                projectsContainer.append(this.renderProjectPreview(project));
            });

        const newProject = document.createElement("article");
        newProject.innerHTML = Add;
        newProject.addEventListener("click", this.newProjectAction)
        projectsContainer.append(newProject);

        this.container.append(projectsContainer);
        
        return this.container;
    }
}