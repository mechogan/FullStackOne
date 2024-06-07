import "./index.css";
import type { Project } from "../../api/projects/types";
import {
    NEW_PROJECT_ID,
    PROJECTS_TITLE,
    SETTINGS_BUTTON_ID
} from "../../constants";
import api from "../../api";

export class Projects {
    newProjectAction: () => void;
    selectProjectAction: (project: Project) => void;
    goToSettings: () => void;
    goToPeers: () => void;

    private container: HTMLDivElement;

    constructor(){
        onPush["peerConnectionsCount"] = () => this.renderPeersButton();
    }

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
            await api.projects.delete(project);
            this.container.replaceWith(await this.render());
        });
        container.append(deleteButton);

        return container;
    }

    private peersButton: HTMLButtonElement;
    private async renderPeersButton(force = false){
        if (!document.body.contains(this.peersButton) && !force) {
            return;
        }

        const [peersIcon, peersConnections] = await Promise.all([
            (await fetch("assets/icons/users.svg")).text(),
            api.connectivity.peers.connections()
        ]);
        this.peersButton.innerHTML = `${peersConnections.length > 0 ? peersConnections.length + "&nbsp;&nbsp;" : ""}${peersIcon}`;
    }

    async render() {
        this.container = document.createElement("div");
        this.container.classList.add("projects");

        const topContainer = document.createElement("div");

        const title = document.createElement("h1");
        title.innerText = PROJECTS_TITLE;
        topContainer.append(title);

        const buttonGroup = document.createElement("div");

        this.peersButton = document.createElement("button");
        this.peersButton.classList.add("text");
        this.peersButton.addEventListener("click", async () => {
            this.goToPeers();
        });
        buttonGroup.append(this.peersButton);
        await this.renderPeersButton(true);

        const settingsButton = document.createElement("button");
        settingsButton.id = SETTINGS_BUTTON_ID;
        settingsButton.classList.add("text");
        const settingsIcon = await (
            await fetch("assets/icons/settings.svg")
        ).text();
        settingsButton.innerHTML = settingsIcon;
        settingsButton.addEventListener("click", async () =>
            this.goToSettings()
        );

        buttonGroup.append(settingsButton);

        topContainer.append(buttonGroup);

        this.container.append(topContainer);

        const projectsContainer = document.createElement("div");

        const projects = (await api.projects.list()).sort(
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
