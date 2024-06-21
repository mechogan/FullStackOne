import "./index.css";
import { FileTree } from "../file-tree";
import { BG_COLOR, IMPORT_PROJECT_FILE_INPUT_ID } from "../../constants";
import projectView from "../project";

import type { Project } from "../../api/config/types";
import api from "../../api";
import stackNavigation from "../../stack-navigation";

class ProjectNew {
    onAddedProject: () => void;

    async render() {
        const container = document.createElement("div");
        container.classList.add("project-new");

        // title
        const titleInputLabel = document.createElement("label");
        titleInputLabel.innerText = "Project Title";
        container.append(titleInputLabel);

        const titleInput = document.createElement("input");
        container.append(titleInput);

        // create button
        const createButton = document.createElement("button");
        createButton.innerText = "Create";

        // git repo
        const gitRepoInputLabel = document.createElement("label");
        gitRepoInputLabel.innerText = "Git Repository (optional)";
        container.append(gitRepoInputLabel);

        const gitRepoInput = document.createElement("input");
        const changeCreateButtonLabel = () => {
            if (gitRepoInput.value) {
                createButton.innerText = "Clone";
            } else {
                createButton.innerText = "Create";
            }
        };
        gitRepoInput.addEventListener("keyup", changeCreateButtonLabel);
        gitRepoInput.addEventListener("keypress", changeCreateButtonLabel);
        gitRepoInput.addEventListener("change", changeCreateButtonLabel);

        container.append(gitRepoInput);

        // location
        const locationLabel = document.createElement("label");
        locationLabel.innerText = "Location";
        container.append(locationLabel);

        const fileTree = new FileTree();
        fileTree.directoryOnly = true;
        container.append(await fileTree.render());

        // buttons
        const buttonContainer = document.createElement("div");

        const cancelButton = document.createElement("button");
        cancelButton.classList.add("text");
        cancelButton.innerText = "Cancel";
        cancelButton.addEventListener("click", () => stackNavigation.back());
        buttonContainer.append(cancelButton);

        const importer = document.createElement("div");

        const inputFile = document.createElement("input");
        inputFile.id = IMPORT_PROJECT_FILE_INPUT_ID;
        inputFile.type = "file";
        inputFile.multiple = false;
        inputFile.accept = ".zip";
        importer.append(inputFile);
        inputFile.addEventListener("click", (e) => e.stopPropagation());
        inputFile.addEventListener("change", async () => {
            if (!inputFile.files?.[0]) return;

            const zipFile = inputFile.files[0];
            const title = zipFile.name.slice(0, -".zip".length);

            const projectBaseDirectory = fileTree.itemSelected
                ? fileTree.itemSelected.isDirectory
                    ? fileTree.itemSelected.path
                    : fileTree.itemSelected.path.slice(0, -1)
                : [];

            const location = [...projectBaseDirectory, title].join("/");
            const project = {
                location,
                title
            };

            cancelButton.replaceWith(document.createElement("div"));
            createButton.replaceWith(document.createElement("div"));
            importButton.innerText = "Importing...";
            importButton.disabled = true;

            const importedProject = await api.projects.import(
                project,
                new Uint8Array(await zipFile.arrayBuffer())
            );

            projectView.setProject(importedProject);
            stackNavigation.back();
            stackNavigation.navigate(await projectView.render(), BG_COLOR);
            this.onAddedProject?.();
        });

        const importButton = document.createElement("button");
        importButton.classList.add("secondary");
        importButton.innerText = "Import";
        importButton.addEventListener("click", (e) => {
            e.stopPropagation();
            inputFile.click();
        });
        importer.append(importButton);

        buttonContainer.append(importer);

        // Create/Clone button
        createButton.addEventListener("click", async () => {
            const projectBaseDirectory = fileTree.itemSelected
                ? fileTree.itemSelected.isDirectory
                    ? fileTree.itemSelected.path
                    : fileTree.itemSelected.path.slice(0, -1)
                : [];

            const location = [...projectBaseDirectory, titleInput.value].join(
                "/"
            );

            const project: Omit<Project, "createdDate"> = {
                title: titleInput.value,
                location
            };

            const gitUrl = gitRepoInput.value;
            if (gitUrl) {
                cancelButton.replaceWith(document.createElement("div"));
                importButton.replaceWith(document.createElement("div"));
                createButton.innerText = "Cloning...";
                createButton.disabled = true;

                await api.git.clone(gitUrl, location);
                const usernameAndEmail =
                    await api.git.getUsernameAndEmailForHost(gitUrl);
                project.gitRepository = {
                    url: gitUrl,
                    name: usernameAndEmail?.username,
                    email: usernameAndEmail?.email
                };
            }

            const newProject = await api.projects.create(project);
            projectView.setProject(newProject);
            stackNavigation.back();
            stackNavigation.navigate(await projectView.render(), BG_COLOR);
            this.onAddedProject?.();
        });
        buttonContainer.append(createButton);

        container.append(buttonContainer);

        return container;
    }
}

export default new ProjectNew();
