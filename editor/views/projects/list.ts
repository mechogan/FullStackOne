import Fuse, { IFuseOptions } from "fuse.js";
import { Dialog } from "../../components/dialog";
import { createElement } from "../../components/element";
import { Popover } from "../../components/popover";
import { Button, ButtonGroup } from "../../components/primitives/button";
import { createRefresheable } from "../../components/refresheable";
import { PROJECTS_VIEW_ID, BG_COLOR } from "../../constants";
import { Store } from "../../store";
import { Project as ProjectType } from "../../types";
import { Project } from "../project";
import { ProjectSettings } from "../project-settings";

export function List() {
    const container = createElement("div");

    const grid = createRefresheable(Grid);
    Store.projects.list.subscribe(grid.refresh);
    container.ondestroy = () => {
        grid.element.destroy();
        Store.projects.list.unsubscribe(grid.refresh);
    };
    container.append(grid.element);

    return container;
}

const fuseOptions: IFuseOptions<ProjectType> = {
    keys: [
        {
            name: "title",
            weight: 0.8
        },
        {
            name: "id",
            weight: 0.3
        }
    ]
};

function Grid(projects: ProjectType[]) {
    const container = createElement("div");

    const fuse = new Fuse(projects, fuseOptions);

    const filteredGrid = createRefresheable(GridFiltered);

    const filter: Parameters<
        typeof Store.projects.filter.value.subscribe
    >[0] = (searchString) => {
        if (!searchString) {
            filteredGrid.refresh(projects);
        } else {
            const fuseResults = fuse.search(searchString);
            filteredGrid.refresh(fuseResults.map(({ item }) => item));
        }
    };

    Store.projects.filter.value.subscribe(filter);
    container.ondestroy = () => Store.projects.filter.value.unsubscribe(filter);
    container.append(filteredGrid.element);

    return container;
}

function GridFiltered(projects: ProjectType[]) {
    const container = createElement("div");
    container.classList.add("projects-list");

    const projectsTiles = [...projects] // sorts in place and screws up Fuse
        .sort((a, b) => b.createdDate - a.createdDate)
        .map(ProjectTile);

    container.append(...projectsTiles);

    return container;
}

function ProjectTile(project: ProjectType) {
    const container = document.createElement("div");
    container.classList.add("project-tile");

    container.onclick = () => Project(project);

    const titleAndId = document.createElement("div");
    titleAndId.classList.add("title-id");
    titleAndId.innerHTML = `
        <h2>${project.title}</h2>
        <div><small>${project.id}</small></div>
    `;
    container.append(titleAndId);

    const optionsButton = Button({
        style: "icon-small",
        iconLeft: "Options"
    });

    optionsButton.onclick = (e) => {
        e.stopPropagation();

        const content = document.createElement("div");
        content.classList.add("options-popover");

        const deleteButton = Button({
            text: "Delete",
            iconLeft: "Trash",
            color: "red"
        });
        deleteButton.onclick = () => {
            const confirm = document.createElement("div");
            confirm.classList.add("confirm");

            confirm.innerHTML = `<p>Are you sure you want to delete <b>${project.title}</b>?</p>`;

            const buttonRow = document.createElement("div");

            const keepButton = Button({
                style: "text",
                text: "Keep"
            });
            const deleteButton = Button({
                color: "red",
                text: "Delete"
            });

            buttonRow.append(keepButton, deleteButton);

            confirm.append(buttonRow);

            const { remove } = Dialog(confirm);

            keepButton.onclick = remove;
            deleteButton.onclick = () => {
                remove();
                Store.projects.deleteP(project);
            };
        };

        const shareButton = Button({
            text: "Share",
            iconLeft: "Export"
        });

        // shareButton.onclick = () => {
        //     api.projects.export(opts.project);
        // };

        const projectSettingsButton = Button({
            text: "Settings",
            iconLeft: "Settings"
        });
        projectSettingsButton.onclick = () => ProjectSettings(project);

        const buttonsGroup = ButtonGroup([
            deleteButton,
            shareButton,
            projectSettingsButton
        ]);

        content.append(buttonsGroup);

        Popover({
            anchor: container,
            content,
            align: {
                y: "bottom",
                x: "right"
            }
        });
    };

    container.append(optionsButton);

    return container;
}
