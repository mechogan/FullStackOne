import "./index.css";

import type { Project } from "../../../api/projects/types";
import type typeRPC from "../../../../src/webview";
import type api from "../../../api";
import { NEW_PROJECT_ID, PROJECTS_TITLE } from "../../../constants";

declare var rpc: typeof typeRPC<typeof api>;

export class Projects {
    newProjectAction: () => void;
    selectProjectAction: (project: Project) => void;

    private container: HTMLDivElement;

    private async renderProjectPreview(project: Project) {
        const container = document.createElement("article");

        const projectTitle = document.createElement("h3");
        projectTitle.innerText = project.title;

        container.append(projectTitle);

        container.addEventListener("click", () => {
            this.selectProjectAction(project);
        });

        const deleteButton = document.createElement("button");
        deleteButton.classList.add("text", "danger", "small");
        deleteButton.innerHTML = await (
            await fetch("/assets/icons/delete.svg")
        ).text();
        deleteButton.addEventListener("click", async (e) => {
            e.stopPropagation();
            await rpc().projects.delete(project);
            this.container.replaceWith(await this.render());
        });
        container.append(deleteButton);

        return container;
    }

    async render() {
        this.container = document.createElement("div");
        this.container.classList.add("projects");

        const topContainer = document.createElement("div");
        topContainer.style.cssText = `display: flex; justify-content:space-between; align-items: flex-start`;

        const title = document.createElement("h1");
        title.innerText = PROJECTS_TITLE;
        topContainer.append(title);

        const deleteNodeModules = document.createElement("button");
        deleteNodeModules.innerText = "Delete Packages";
        deleteNodeModules.classList.add("danger");
        deleteNodeModules.addEventListener("click", () =>
            rpc().fs.rmdir(".config/fullstacked/node_modules")
        );
        topContainer.append(deleteNodeModules);

        this.container.append(topContainer);

        const projectsContainer = document.createElement("div");

        const projects = (await rpc().projects.list()).sort(
            (projectA, projectB) => projectB.createdDate - projectA.createdDate
        );

        for (const project of projects) {
            projectsContainer.append(await this.renderProjectPreview(project));
        }

        const newProject = document.createElement("article");
        newProject.id = NEW_PROJECT_ID;
        newProject.innerHTML = await (
            await fetch("/assets/icons/add.svg")
        ).text();
        newProject.addEventListener("click", this.newProjectAction);
        projectsContainer.append(newProject);

        this.container.append(projectsContainer);

        return this.container;
    }
}
