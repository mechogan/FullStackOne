import type { Project as ProjectType } from "../../types";
import {
    BG_COLOR,
    PROJECT_VIEW_ID
} from "../../constants";
import stackNavigation from "../../stack-navigation";
import { TopBar as TopBarComponent } from "../../components/top-bar";
import { Button } from "../../components/primitives/button";
import { FileTree } from "./file-tree";
import { Editor } from "./editor";
import { Store } from "../../store";

export function Project(project: ProjectType) {
    Store.project.setCurrentProject(project);

    const container = document.createElement("div");
    container.id = PROJECT_VIEW_ID;
    container.classList.add("view");

    const fileTreeAndEditor = FileTreeAndEditor(project)

    container.append(
        TopBar(project, fileTreeAndEditor),
        fileTreeAndEditor
    )

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: () => {
            
        }
    })
}

function TopBar(project: ProjectType, fileTreeAndEditor: HTMLElement) {
    const topBar = TopBarComponent({
        title: project.title,
        subtitle: project.id,
        actions: TopBarActions(),
        onBack: () => {
            if (fileTreeAndEditor.classList.contains("closed-panel")) {
                fileTreeAndEditor.classList.remove("closed-panel");
                return false;
            }

            return true;
        }
    });

    return topBar;
}

function TopBarActions() {
    const gitButton = Button({
        style: "icon-large",
        iconLeft: "Git"
    });

    const tsButton = Button({
        style: "icon-large",
        iconLeft: "TypeScript"
    });

    const runButton = Button({
        style: "icon-large",
        iconLeft: "Play"
    });

    return [gitButton, tsButton, runButton]
}

function FileTreeAndEditor(project: ProjectType){
    const container = document.createElement("div");
    container.classList.add("file-tree-and-editor");

    container.append(
        FileTree(project),
        Editor(project)
    )

    return container;
}