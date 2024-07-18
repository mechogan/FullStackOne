import "./index.css";
import type { Project } from "../../api/config/types";
import {
    BG_COLOR,
    NEW_PROJECT_ID,
    PEERS_ICON_ID,
    PROJECTS_TITLE,
    SETTINGS_BUTTON_ID
} from "../../constants";
import api from "../../api";
import stackNavigation from "../../stack-navigation";
import peers from "../peers";
import projectNew from "../project-new";
import projectView from "../project";
import settings from "../settings";

class Projects {
    private projectsList: HTMLDivElement;

    constructor() {
        onPush["peerConnectionsCount"] = () => this.renderPeersButton();
    }

    private async renderProjectTile(project: Project) {
        const container = document.createElement("article");

        const projectTitle = document.createElement("h3");
        projectTitle.innerText = project.title;
        container.append(projectTitle);

        const projectId = document.createElement("p");
        projectId.innerText = project.id;
        container.append(projectId);

        container.addEventListener("click", async () => {
            projectView.setProject(project);
            stackNavigation.navigate(await projectView.render(), BG_COLOR);
        });

        const deleteButton = document.createElement("button");
        deleteButton.classList.add("text", "danger", "small");
        deleteButton.innerHTML = await (
            await fetch("/assets/icons/delete.svg")
        ).text();
        deleteButton.addEventListener("click", async (e) => {
            e.stopPropagation();
            await api.projects.delete(project);
            this.renderProjectsList();
        });
        container.append(deleteButton);

        return container;
    }

    private peersButton: HTMLButtonElement;
    private async renderPeersButton(force = false) {
        if (!document.body.contains(this.peersButton) && !force) {
            return;
        }

        const [peersIcon, peersConnections] = await Promise.all([
            (await fetch("assets/icons/users.svg")).text(),
            api.connectivity.peers.connections()
        ]);
        this.peersButton.innerHTML = `${peersConnections.length > 0 ? peersConnections.length + "&nbsp;&nbsp;" : ""}${peersIcon}`;
    }

    async renderProjectsList() {
        Array.from(this.projectsList.children).forEach((e) => e.remove());

        const projects = (await api.projects.list()).sort(
            (projectA, projectB) => projectB.createdDate - projectA.createdDate
        );

        for (const project of projects) {
            this.projectsList.append(await this.renderProjectTile(project));
        }

        projectNew.onAddedProject = () => this.renderProjectsList();

        const newProject = document.createElement("article");
        newProject.id = NEW_PROJECT_ID;
        newProject.innerHTML = await (
            await fetch("/assets/icons/add.svg")
        ).text();
        newProject.addEventListener("click", async () => {
            stackNavigation.navigate(await projectNew.render(), BG_COLOR);
        });
        this.projectsList.append(newProject);
    }

    async render() {
        const container = document.createElement("div");
        container.classList.add("projects");

        const topContainer = document.createElement("div");

        const title = document.createElement("h1");
        title.innerText = PROJECTS_TITLE;
        topContainer.append(title);

        const buttonGroup = document.createElement("div");

        this.peersButton = document.createElement("button");
        this.peersButton.id = PEERS_ICON_ID;
        this.peersButton.classList.add("text");
        this.peersButton.addEventListener("click", async () => {
            stackNavigation.navigate(await peers.render(), BG_COLOR);
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
            stackNavigation.navigate(await settings.render(), BG_COLOR)
        );

        buttonGroup.append(settingsButton);

        topContainer.append(buttonGroup);

        container.append(topContainer);

        this.projectsList = document.createElement("div");

        await this.renderProjectsList();

        container.append(this.projectsList);

        return container;
    }
}

export default new Projects();
