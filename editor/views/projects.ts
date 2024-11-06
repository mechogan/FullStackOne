import api from "../api";
import { Project as ProjectType } from "../api/config/types";
import { Dialog } from "../components/dialog";
import { Popover } from "../components/popover";
import { Button, ButtonGroup } from "../components/primitives/button";
import { InputText } from "../components/primitives/inputs";
import { TopBar as TopBarComponent } from "../components/top-bar";
import { ViewScrollable } from "../components/view-scrollable";
import {
    BG_COLOR,
    NEW_PROJECT_ID,
    PEERS_BUTTON_ID,
    PROJECTS_TITLE,
    PROJECTS_VIEW_ID,
    SETTINGS_BUTTON_ID
} from "../constants";
import { ipcEditor } from "../ipc";
import stackNavigation from "../stack-navigation";
import { CONFIG_TYPE } from "../types";
import { AddProject } from "./add-project";
import { Peers } from "./peers";
import { Project } from "./project";
import { ProjectSettings } from "./project-settings";
import { Settings } from "./settings";
import Fuse, { IFuseOptions } from "fuse.js";

let projectListPromise: ReturnType<
    typeof ipcEditor.config.get<CONFIG_TYPE.PROJECTS>
>;
const getProjectsList = () => {
    if (!projectListPromise) {
        projectListPromise = ipcEditor.config.get(CONFIG_TYPE.PROJECTS);
        setTimeout(() => (projectListPromise = null), 300);
    }

    return projectListPromise;
};

export function Projects() {
    const { container, scrollable } = ViewScrollable();
    container.id = "projects-view";

    container.prepend(TopBar());

    let elements: {
        projectsList: ReturnType<typeof ProjectsList>;
        searchAndAdd: ReturnType<typeof SearchAndAdd>;
    };
    const reloadProjectsList = () => {
        const updatedProjectList = ProjectsList({
            didUpdateProject: reloadProjectsList
        });
        const updatedSearchAndAdd = SearchAndAdd({
            didAddProject: () => {
                stackNavigation.back();
                reloadProjectsList();
            },
            didSearch: (projects) => {
                updatedProjectList.filter(projects);
            }
        });
        if (elements) {
            elements.projectsList.container.replaceWith(
                updatedProjectList.container
            );
            elements.searchAndAdd.replaceWith(updatedSearchAndAdd);
        } else {
            scrollable.append(
                updatedSearchAndAdd,
                updatedProjectList.container
            );
        }

        elements = {
            projectsList: updatedProjectList,
            searchAndAdd: updatedSearchAndAdd
        };
    };
    reloadProjectsList();

    return { container, reloadProjectsList };
}

function TopBar() {
    const settings = Button({
        style: "icon-large",
        iconLeft: "Settings"
    });
    settings.id = SETTINGS_BUTTON_ID;

    settings.onclick = () => {
        stackNavigation.navigate(Settings(), BG_COLOR);
    };

    const topBar = TopBarComponent({
        noBack: true,
        title: PROJECTS_TITLE,
        actions: [PeersWidget(), settings]
    });

    return topBar;
}

function PeersWidget() {
    const container = document.createElement("div");
    container.classList.add("peers-widget");

    const peersConnectedCount = document.createElement("div");
    const renderPeersConnectedCount = () => {
        // const count = api.connectivity.peers.connections().size;
        // peersConnectedCount.innerText = count !== 0 ? count.toString() : "";
    };
    renderPeersConnectedCount();
    // api.connectivity.peers.onPeersEvent.add(renderPeersConnectedCount);

    const peersButton = Button({
        style: "icon-large",
        iconLeft: "Peers"
    });
    peersButton.id = PEERS_BUTTON_ID;
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
        getProjectsList().then((projects) => {
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
    addButton.id = NEW_PROJECT_ID;

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

type ProjectsListOpts = {
    didUpdateProject: () => void;
};

function ProjectsList(opts: ProjectsListOpts) {
    const container = document.createElement("div");
    container.classList.add("projects-list");

    const projectsTiles: {
        project: ProjectType;
        tile: ReturnType<typeof ProjectTile>;
    }[] = [];
    getProjectsList().then((projects) => {
        projects
            .sort((a, b) => b.createdDate - a.createdDate)
            .forEach((project) => {
                const tile = ProjectTile({
                    project,
                    didUpdateProject: opts.didUpdateProject
                });
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

type ProjectTileOpts = {
    project: ProjectType;
    didUpdateProject: () => void;
};

function ProjectTile(opts: ProjectTileOpts) {
    const container = document.createElement("div");
    container.id = PROJECTS_VIEW_ID;
    container.classList.add("project-tile");

    container.onclick = () =>
        stackNavigation.navigate(
            Project({
                project: opts.project,
                didUpdateProject: opts.didUpdateProject
            }),
            BG_COLOR
        );

    const titleAndId = document.createElement("div");
    titleAndId.classList.add("title-id");
    titleAndId.innerHTML = `
        <h2>${opts.project.title}</h2>
        <div><small>${opts.project.id}</small></div>
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

            confirm.innerHTML = `<p>Are you sure you want to delete <b>${opts.project.title}</b>?</p>`;

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
                api.projects.delete(opts.project);
                remove();
                container.remove();
            };
        };

        const shareButton = Button({
            text: "Share",
            iconLeft: "Export"
        });
        shareButton.onclick = () => {
            api.projects.export(opts.project);
        };

        const projectSettingsButton = Button({
            text: "Settings",
            iconLeft: "Settings"
        });
        projectSettingsButton.onclick = () => {
            stackNavigation.navigate(
                ProjectSettings({
                    project: opts.project,
                    didUpdateProject: () => {
                        stackNavigation.back();
                        opts.didUpdateProject();
                    }
                }),
                BG_COLOR
            );
        };

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
