import type { Project as ProjectType } from "../../types";
import { BG_COLOR, PROJECT_VIEW_ID, RUN_PROJECT_ID } from "../../constants";
import stackNavigation from "../../stack-navigation";
import { TopBar as TopBarComponent } from "../../components/top-bar";
import { Button } from "../../components/primitives/button";
import { FileTree } from "./file-tree";
import { Store } from "../../store";
import { createElement, ElementComponent } from "../../components/element";
import { Editor } from "./editor";
import { WorkerTS } from "../../typescript";
import { Loader } from "../../components/loader";
import { saveAllViews } from "./code-editor";
import { Git } from "./git";
import { Icon } from "../../components/primitives/icon";
import { createRefresheable } from "../../components/refresheable";
import fs from "../../../lib/fs";
import git from "../../lib/git";
import core_message from "../../../lib/core_message";
import { Terminal } from "./terminal";

let lastOpenedProjectId: string;
export function Project(project: ProjectType, run = false) {
    // gives a chance if back button by mistake
    if (lastOpenedProjectId !== project.id) {
        Store.editor.codeEditor.clearFiles();
        Store.editor.codeEditor.clearAllBuildErrors();
        WorkerTS.dispose();
    }

    lastOpenedProjectId = project.id;

    const container = createElement("div");
    container.id = PROJECT_VIEW_ID;
    container.classList.add("view");

    const fileTreeAndEditor = FileTreeAndEditor(project);
    const topBar = TopBar(project, fileTreeAndEditor);
    const terminal = Terminal(project);

    container.append(topBar, fileTreeAndEditor, terminal);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: () => {
            topBar.destroy();
            fileTreeAndEditor.destroy();
            terminal.destroy();
            container.destroy();
        }
    });

    return container;
}

function TopBar(project: ProjectType, fileTreeAndEditor: HTMLElement) {
    const actions: ElementComponent[] = [];

    const gitWidget = GitWidget(project);

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
    tsButton.onclick = () => {
        WorkerTS.restart();
    };
    tsButton.ondestroy = () => {
        WorkerTS.working.unsubscribe(flashOnWorking);
    };

    const runButton = RunButton(project);

    actions.push(gitWidget, tsButton, runButton);

    const topBar = TopBarComponent({
        title: project.title,
        subtitle: project.id,
        actions,
        onBack: () => {
            if (fileTreeAndEditor.classList.contains("closed-panel")) {
                Store.editor.setSidePanelClosed(false);
                return false;
            }

            return true;
        }
    });

    topBar.ondestroy = () => {
        actions.forEach((e) => e.destroy());
        gitWidget?.destroy();
        runButton?.destroy();
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

    const leftPanel = document.createElement("div");
    leftPanel.classList.add("left-panel");

    const buttonContainer = document.createElement("div");

    const toggleButtonVisibility = (terminalOpen: boolean) => {
        if (terminalOpen) {
            buttonContainer.classList.add("hide");
        } else {
            buttonContainer.classList.remove("hide");
        }
    };
    Store.editor.terminalOpen.subscribe(toggleButtonVisibility);

    const terminalButton = Button({
        style: "text",
        iconLeft: "Terminal"
    });
    terminalButton.onclick = () => {
        Store.editor.setTerminalOpen(true);
    };
    buttonContainer.append(terminalButton);

    leftPanel.append(fileTree, buttonContainer);

    container.append(leftPanel, editor);

    container.ondestroy = () => {
        fileTree.destroy();
        editor.destroy();
        Store.editor.terminalOpen.unsubscribe(toggleButtonVisibility);
    };

    return container;
}

function RunButton(project: ProjectType) {
    const container = createElement("div");
    const clearContainer = () => {
        Array.from(container.children).find((c) => c.remove());
    };

    const button = Button({
        style: "icon-large",
        iconLeft: "Play"
    });
    button.id = RUN_PROJECT_ID;
    const showButton = () => {
        if (Array.from(container.children).find((c) => c === button)) {
            return;
        }
        clearContainer();
        container.append(button);
    };

    const loaderContainer = document.createElement("div");
    loaderContainer.classList.add("loader-container");
    loaderContainer.append(Loader());
    const showLoader = () => {
        if (Array.from(container.children).find((c) => c === loaderContainer)) {
            return;
        }
        clearContainer();
        container.append(loaderContainer);
    };

    const onBuild = (projectsBuild: Set<string>) => {
        if (projectsBuild.has(project.id)) {
            showLoader();
        } else {
            showButton();
        }
    };
    Store.projects.builds.subscribe(onBuild);

    button.onclick = async () => {
        showLoader();
        await saveAllViews();
        Store.projects.build(project);
    };

    showButton();

    container.ondestroy = () => {
        Store.projects.builds.unsubscribe(onBuild);
    };

    return container;
}

let refreshBranchAndCommit: ReturnType<typeof createRefresheable>["refresh"];
export const refreshGitWidgetBranchAndCommit = () => {
    refreshBranchAndCommit?.();
};
function GitWidget(project: ProjectType) {
    const container = createElement("div");
    container.classList.add("git-widget");

    const hasGit = Boolean(project.gitRepository?.url);
    const gitButton = Button({
        style: "icon-large",
        iconLeft: "Git"
    });
    gitButton.disabled = !hasGit;
    gitButton.onclick = () => Git(project);
    container.append(gitButton);

    if (!hasGit) return container;

    const branchAndCommitRender = async () => {
        const result = await git.head(project.id);
        const branchAndCommitContainer = createElement("div");
        branchAndCommitContainer.innerHTML = `
                <div><b>${result.Name}</b></div>
                <div>${result.Hash.slice(0, 7)}<div>
            `;
        return branchAndCommitContainer;
    };

    const branchAndCommit = createRefresheable(branchAndCommitRender);
    container.prepend(branchAndCommit.element);
    refreshBranchAndCommit = branchAndCommit.refresh;
    refreshBranchAndCommit();

    const statusArrow = Icon("Arrow 2");
    statusArrow.classList.add("git-status-arrow");
    statusArrow.style.display = "none";
    container.append(statusArrow);

    const pullEvent = (gitProgress: string) => {
        statusArrow.style.display = "flex";
        statusArrow.classList.remove("red");

        let json: { Url: string; Data: string };
        try {
            json = JSON.parse(gitProgress);
        } catch (e) {
            return;
        }

        if (json.Data.endsWith("done")) {
            statusArrow.style.display = "none";
            branchAndCommit.refresh();
        }
    };

    const pushEvent = (gitProgress: string) => {
        statusArrow.style.display = "flex";
        statusArrow.classList.add("red");

        let json: { Url: string; Data: string };
        try {
            json = JSON.parse(gitProgress);
        } catch (e) {
            return;
        }

        if (json.Data.endsWith("done")) {
            statusArrow.style.display = "none";
            branchAndCommit.refresh();
        }
    };

    core_message.addListener("git-pull", pullEvent);
    core_message.addListener("git-push", pushEvent);

    container.ondestroy = () => {
        core_message.removeListener("git-pull", pullEvent);
        core_message.removeListener("git-push", pushEvent);
    };

    git.pull(project);

    return container;
}
