import type { Project as ProjectType } from "../../types";
import { BG_COLOR, PROJECT_VIEW_ID } from "../../constants";
import stackNavigation from "../../stack-navigation";
import { TopBar as TopBarComponent } from "../../components/top-bar";
import { Button } from "../../components/primitives/button";
import { FileTree } from "./file-tree";
import { Store } from "../../store";
import { createElement } from "../../components/element";
import { Editor } from "./editor";
// import { Editor } from "./editor";

export function Project(project: ProjectType) {
    const container = document.createElement("div");
    container.id = PROJECT_VIEW_ID;
    container.classList.add("view");

    const fileTreeAndEditor = FileTreeAndEditor(project);

    container.append(TopBar(project, fileTreeAndEditor), fileTreeAndEditor);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: () => {
            fileTreeAndEditor.destroy();
        }
    });
}

function TopBar(project: ProjectType, fileTreeAndEditor: HTMLElement) {
    const topBar = TopBarComponent({
        title: project.title,
        subtitle: project.id,
        actions: TopBarActions(),
        onBack: () => {
            if (fileTreeAndEditor.classList.contains("closed-panel")) {
                Store.editor.setSidePanelClosed(false);
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

    return [gitButton, tsButton, runButton];
}

function FileTreeAndEditor(project: ProjectType) {
    const container = createElement("div");
    container.classList.add("file-tree-and-editor");

    const toggleSidePanel = (closed: boolean) => {
        if (closed) {
            container.classList.add("closed-panel");
        } else {
            container.classList.remove("closed-panel");
        }
    };

    Store.editor.sidePanelClosed.subscribe(toggleSidePanel);
    container.ondestroy = () =>
        Store.editor.sidePanelClosed.unsubscribe(toggleSidePanel);

    const fileTree = FileTree(project);
    const editor = Editor(project);

    container.append(fileTree, editor);

    container.ondestroy = () => {
        fileTree.destroy();
        editor.destroy();
    };

    return container;
}
