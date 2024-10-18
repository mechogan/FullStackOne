import api from "../../../api";
import type { Project, Project as ProjectType } from "../../../api/config/types";
import { Loader } from "../../../components/loader";
import { Button } from "../../../components/primitives/button";
import { Icon } from "../../../components/primitives/icon";
import { TopBar } from "../../../components/top-bar";
import { WorkerTS } from "../../../typescript";
import { CodeEditor } from "./code-editor";
import { Editor } from "./editor";
import { FileTree } from "./file-tree";
import { Git } from "./git";

type ProjectOpts = {
    project: ProjectType,
    fileTree?: ReturnType<typeof FileTree>
}

export function Project(opts: ProjectOpts) {
    const container = document.createElement("div");
    container.id = "project";
    container.classList.add("view");

    WorkerTS.dispose();
    const tsButton = Button({
        style: "icon-large",
        iconLeft: "TypeScript"
    });
    WorkerTS.working = () => {
        tsButton.disabled = false;

        if (WorkerTS.reqs.size > 0) {
            tsButton.classList.add("working");
        } else {
            tsButton.classList.remove("working");
        }
    };
    tsButton.disabled = true;
    tsButton.onclick = () => {
        WorkerTS.dispose();
        WorkerTS.start(opts.project.location);
    };

    const runButton = Button({
        style: "icon-large",
        iconLeft: "Play"
    });
    runButton.onclick = () => {
        const loaderContainer = document.createElement("div");
        loaderContainer.classList.add("loader-container");
        loaderContainer.append(Loader());
        runButton.replaceWith(loaderContainer);
    };

    const pullEvents: PullEvents = {
        start: null,
        end: null
    }
    const gitWidget = GitWidget(opts, pullEvents);

    const topBar = TopBar({
        title: opts.project.title,
        subtitle: opts.project.id,
        actions: [gitWidget, tsButton, runButton],
        onBack: () => {
            if (content.classList.contains("closed-panel")) {
                content.classList.remove("closed-panel");
                return false;
            }

            return true;
        }
    });

    container.append(topBar);

    const content = document.createElement("div");
    content.classList.add("content");

    opts.fileTree = FileTree({
        directory: opts.project.location,
        onClosePanel: () => {
            content.classList.add("closed-panel");
        }
    });

    content.append(
        opts.fileTree.container,
        Editor({
            directory: opts.project.location
        })
    );
    container.append(content);


    pullEvents.start?.();
    api.git.pull(opts.project)
        .then(() => {
            pullEvents.end?.();
            CodeEditor.reloadActiveFilesContent();
            opts.fileTree.reloadFileTree();
        })

    return container;
}

type PullEvents = {
    start: () => void
    end: () => void
}

function GitWidget(opts: ProjectOpts, pullEvents: PullEvents, statusArrow = null) {
    const container = document.createElement("div");
    container.classList.add("git-widget");

    const branchAndCommitContainer = document.createElement("div");
    container.append(branchAndCommitContainer);

    const renderBranchAndCommit = () => {
        Promise.all([
            api.git.currentBranch(opts.project),
            api.git.log(opts.project, 1)
        ]).then(([branch, commit]) => {
            branchAndCommitContainer.innerHTML = `
                <div><b>${branch}</b></div>
                <div>${commit.at(0).oid.slice(0, 7)}<div>
            `
        })
    }

    const gitButton = Button({
        style: "icon-large",
        iconLeft: "Git"
    });
    gitButton.disabled = true;
    api.git
        .currentBranch(opts.project)
        .then(() => {
            gitButton.disabled = false;
            renderBranchAndCommit();
        })
        .catch(() => { });

    gitButton.onclick = () => {
        let remove: ReturnType<typeof Git>;

        const reloadGit = () => {
            remove?.();
            remove = Git({
                project: opts.project,
                didUpdateProject: async () => {
                    opts.project = (await api.projects.list()).find(
                        ({ id }) => opts.project.id === id
                    );
                    reloadGit();
                },
                didUpdateFiles: () => opts.fileTree.reloadFileTree(),
                didChangeCommitOrBranch: () => {
                    container.replaceWith(GitWidget(opts, pullEvents, statusArrow))
                },
                didPushEvent: (event) => {
                    if(event === "start") {
                        statusArrow.style.display = "flex";
                        statusArrow.classList.add("red");
                    } else {
                        statusArrow.style.display = "none";
                    }
                },
            });
        };

        reloadGit();
    };

    container.append(gitButton);

    if(!statusArrow) {
        statusArrow = Icon("Arrow 2");
        statusArrow.classList.add("git-status-arrow");
        statusArrow.style.display = "none";
    }
    container.append(statusArrow)
    

    pullEvents.start = () => {
        statusArrow.style.display = "flex";
        statusArrow.classList.remove("red");
    }
    pullEvents.end = () => {
        statusArrow.style.display = "none";
    }

    container.append(statusArrow)

    return container;
}