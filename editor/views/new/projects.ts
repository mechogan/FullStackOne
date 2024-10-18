import api from "../../api";
import { Project as ProjectType } from "../../api/config/types";
import { Dialog } from "../../components/dialog";
import { Popover } from "../../components/popover";
import { Button, ButtonGroup } from "../../components/primitives/button";
import { InputText } from "../../components/primitives/inputs";
import { TopBar as TopBarComponent } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";
import { BG_COLOR } from "../../constants";
import stackNavigation from "../../stack-navigation";
import { AddProject, AddProjectOpts } from "./add-project";
import { Peers } from "./peers";
import { Project } from "./project";
import { Settings } from "./settings";

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
                projectList.replaceWith(updatedProjectList);
                projectList = updatedProjectList;
            }
        }),
        projectList
    );

    return container;
}

function TopBar() {
    const peers = Button({
        style: "icon-large",
        iconLeft: "Peers"
    });

    peers.onclick = () => stackNavigation.navigate(Peers(), BG_COLOR);

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
        actions: [peers, settings]
    });

    return topBar;
}

function SearchAndAdd(opts: AddProjectOpts) {
    const container = document.createElement("div");
    container.classList.add("search-and-add");

    const inputText = InputText({
        label: "Search"
    });

    const addButton = Button({
        style: "icon-large",
        iconLeft: "Plus"
    });

    addButton.onclick = () => {
        stackNavigation.navigate(AddProject(opts), BG_COLOR);
    };

    container.append(inputText.container, addButton);

    return container;
}

function ProjectsList() {
    const container = document.createElement("div");
    container.classList.add("projects-list");

    api.projects.list().then((projects) => {
        projects
            .sort((a, b) => {
                const lastDateA = a.updatedDate || a.createdDate;
                const lastDateB = b.updatedDate || b.createdDate;
                return lastDateB - lastDateA;
            })
            .forEach((project) => {
                container.append(ProjectTile(project));
            });
    });

    return container;
}

function ProjectTile(project: ProjectType) {
    const container = document.createElement("div");
    container.classList.add("project-tile");

    container.onclick = () =>
        stackNavigation.navigate(Project({ project }), BG_COLOR);

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

        const buttonsGroup = ButtonGroup([
            deleteButton,
            // Button({
            //     text: "Settings",
            //     iconLeft: "Settings"
            // }),
            Button({
                text: "Share",
                iconLeft: "Export"
            })
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
