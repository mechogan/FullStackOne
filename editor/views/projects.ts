import api from "../api";
import { Project as ProjectType } from "../api/config/types";
import { Dialog } from "../components/dialog";
import { Popover } from "../components/popover";
import { Button, ButtonGroup } from "../components/primitives/button";
import { InputText } from "../components/primitives/inputs";
import { TopBar as TopBarComponent } from "../components/top-bar";
import { ViewScrollable } from "../components/view-scrollable";
import { BG_COLOR } from "../constants";
import stackNavigation from "../stack-navigation";
import { AddProject } from "./add-project";
import { Peers } from "./peers";
import { Project } from "./project";
import { Settings } from "./settings";
import Fuse, { IFuseOptions } from "fuse.js";

export function Projects() {
    const { container, scrollable } = ViewScrollable();
    container.id = "projects-view";

    container.prepend(TopBar());

    let projectList = ProjectsList();
    scrollable.append(
        SearchAndAdd({
            didAddProject: () => {
                stackNavigation.back();
                const updatedProjectList = ProjectsList();
                projectList.container.replaceWith(updatedProjectList.container);
                projectList = updatedProjectList;
            },
            didSearch: (projects) => {
                projectList.filter(projects);
            }
        }),
        projectList.container
    );

    return container;
}

function TopBar() {
    const settings = Button({
        style: "icon-large",
        iconLeft: "Settings"
    });

    settings.onclick = () => {
        stackNavigation.navigate(Settings(), BG_COLOR);
    };

    const topBar = TopBarComponent({
        noBack: true,
        title: "Projects",
        actions: [PeersWidget(), settings]
    });

    return topBar;
}

function PeersWidget() {
    const container = document.createElement("div");
    container.classList.add("peers-widget");

    const peersConnectedCount = document.createElement("div");
    const renderPeersConnectedCount = () => {
        const count = api.connectivity.peers.connections().size;
        peersConnectedCount.innerText = count !== 0 ? count.toString() : "";
    };
    renderPeersConnectedCount();
    api.connectivity.peers.onPeersEvent.add(renderPeersConnectedCount);

    const peersButton = Button({
        style: "icon-large",
        iconLeft: "Peers"
    });

    peersButton.onclick = () => stackNavigation.navigate(Peers(), BG_COLOR);

    container.append(peersConnectedCount, peersButton);

    return container;
}

type SearchAndAddOpts = {
    didAddProject: () => void;
    didSearch: (projects: ProjectType[]) => void;
};

function SearchAndAdd(opts: SearchAndAddOpts) {
    const container = document.createElement("div");
    container.classList.add("search-and-add");

    const searchInput = InputText({
        label: "Search"
    });

    let fuseSearch: Fuse<ProjectType>;
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

    const reloadFuse = () => {
        api.projects.list().then((projects) => {
            fuseSearch = new Fuse([...projects], fuseOptions);
        });
    };
    reloadFuse();

    searchInput.input.onkeyup = () => {
        if (!fuseSearch) return;
        const searchStr = searchInput.input.value;
        if (!searchStr) {
            opts.didSearch(null);
        } else {
            const fuseResults = fuseSearch.search(searchStr);
            opts.didSearch(fuseResults.map(({ item }) => item));
        }
    };

    const addButton = Button({
        style: "icon-large",
        iconLeft: "Plus"
    });

    addButton.onclick = () => {
        stackNavigation.navigate(
            AddProject({
                didAddProject: () => {
                    reloadFuse();
                    searchInput.input.value = "";
                    opts.didAddProject();
                }
            }),
            BG_COLOR
        );
    };

    container.append(searchInput.container, addButton);

    return container;
}

function ProjectsList() {
    const container = document.createElement("div");
    container.classList.add("projects-list");

    const projectsTiles: {
        project: ProjectType;
        tile: ReturnType<typeof ProjectTile>;
    }[] = [];
    api.projects.list().then((projects) => {
        projects
            .sort((a, b) => b.createdDate - a.createdDate)
            .forEach((project) => {
                const tile = ProjectTile(project);
                projectsTiles.push({
                    project,
                    tile
                });
                container.append(tile);
            });
    });

    const filter = (projects: ProjectType[]) => {
        projectsTiles.forEach((projectTile) => {
            if (
                projects === null ||
                projects.find(
                    (project) => projectTile.project.id === project.id
                )
            ) {
                projectTile.tile.style.display = "flex";
            } else {
                projectTile.tile.style.display = "none";
            }
        });
    };

    return { container, filter };
}

function ProjectTile(project: ProjectType) {
    const container = document.createElement("div");
    container.classList.add("project-tile");

    container.onclick = () =>
        stackNavigation.navigate(
            Project({
                project,
                didUpdateProject: async () => {
                    project = (await api.projects.list()).find(
                        ({ id }) => project.id === id
                    );
                }
            }),
            BG_COLOR
        );

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
                api.projects.delete(project);
                remove();
                container.remove();
            };
        };

        const shareButton = Button({
            text: "Share",
            iconLeft: "Export"
        });
        shareButton.onclick = () => {
            api.projects.export(project);
        }

        const buttonsGroup = ButtonGroup([
            deleteButton,
            shareButton
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
