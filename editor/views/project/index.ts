import type { Project as ProjectType } from "../../types";
import { BG_COLOR, PROJECT_VIEW_ID } from "../../constants";
import stackNavigation from "../../stack-navigation";
import { TopBar as TopBarComponent } from "../../components/top-bar";
import { Button } from "../../components/primitives/button";
import { FileTree } from "./file-tree";
import { Store } from "../../store";
import { createElement } from "../../components/element";
import { Editor } from "./editor";
import { WorkerTS } from "../../typescript";
import { ipcEditor } from "../../ipc";
import { Loader } from "../../components/loader";

let lastOpenedProjectId: string;
export function Project(project: ProjectType) {
    // gives a chance if back button by mistake
    if (lastOpenedProjectId !== project.id) {
        Store.editor.codeEditor.clearFiles();
        Store.editor.fileTree.setActiveItem(null);
        Store.editor.fileTree.clearOpenedDirectories();
    }

    lastOpenedProjectId = project.id;

    const container = document.createElement("div");
    container.id = PROJECT_VIEW_ID;
    container.classList.add("view");

    const fileTreeAndEditor = FileTreeAndEditor(project);
    const topBar = TopBar(project, fileTreeAndEditor);

    container.append(topBar, fileTreeAndEditor);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: () => {
            topBar.destroy();
            fileTreeAndEditor.destroy();
        }
    });
}

function TopBar(project: ProjectType, fileTreeAndEditor: HTMLElement) {
    const gitButton = Button({
        style: "icon-large",
        iconLeft: "Git"
    });

    const tsButton = Button({
        style: "icon-large",
        iconLeft: "TypeScript"
    });

    tsButton.disabled = true;
    const flashOnWorking = (request: Map<number, Function>) => {
        if (request.size > 0) {
            tsButton.disabled = false;
            tsButton.classList.add("working");
        } else {
            tsButton.classList.remove("working");
        }
    };
    WorkerTS.working.subscribe(flashOnWorking);

    const runButton = Button({
        style: "icon-large",
        iconLeft: "Play"
    });

    runButton.onclick = async () => {
        Store.editor.codeEditor.clearAllBuildErrors();
        const loaderContainer = document.createElement("div");
        loaderContainer.classList.add("loader-container");
        loaderContainer.append(Loader());
        runButton.replaceWith(loaderContainer);
        const buildErrors = await ipcEditor.esbuild.build(project);
        if (buildErrors?.length) {
            buildErrors.forEach((error) => {
                if(!error.location) return;
                Store.editor.codeEditor.addBuildError({
                    file: error.location.file,
                    line: error.location.line,
                    col: error.location.column,
                    length: error.location.length,
                    message: error.text
                });
            });
        } else {
        }
        loaderContainer.replaceWith(runButton);
    };

    const topBar = TopBarComponent({
        title: project.title,
        subtitle: project.id,
        actions: [gitButton, tsButton, runButton],
        onBack: () => {
            if (fileTreeAndEditor.classList.contains("closed-panel")) {
                Store.editor.setSidePanelClosed(false);
                return false;
            }

            return true;
        }
    });

    topBar.ondestroy = () => {
        WorkerTS.working.unsubscribe(flashOnWorking);
    };

    return topBar;
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
