import type { Project as ProjectType } from "../../types";
import {
    BG_COLOR,
    DELETE_ALL_PACKAGES_ID,
    PROJECT_VIEW_ID,
    RUN_PROJECT_ID
} from "../../constants";
import stackNavigation from "../../stack-navigation";
import { TopBar as TopBarComponent } from "../../components/top-bar";
import { Button } from "../../components/primitives/button";
import { FileTree } from "./file-tree";
import { Store } from "../../store";
import { createElement, ElementComponent } from "../../components/element";
import { Editor } from "./editor";
import { WorkerTS } from "../../typescript";
import { Loader } from "../../components/loader";
import * as sass from "sass";
import type { Message } from "esbuild";
import { saveAllViews } from "./code-editor";
import { Git } from "./git";
import { Icon } from "../../components/primitives/icon";
import { createRefresheable } from "../../components/refresheable";
import fs from "../../../lib/fs";
import esbuild from "../../lib/esbuild";
import core_open from "../../lib/core_open";
import git from "../../lib/git";
import core_message from "../../../lib/core_message";

let lastOpenedProjectId: string,
    autoRunning = false,
    runFn: () => void;
export function Project(project: ProjectType, run = false) {
    // gives a chance if back button by mistake
    if (lastOpenedProjectId !== project.id) {
        Store.editor.codeEditor.clearFiles();
        Store.editor.codeEditor.clearAllBuildErrors();
        WorkerTS.dispose();
        autoRunning = false;
    }

    lastOpenedProjectId = project.id;

    const container = createElement("div");
    container.id = PROJECT_VIEW_ID;
    container.classList.add("view");

    const fileTreeAndEditor = FileTreeAndEditor(project);
    const topBar = TopBar(project, fileTreeAndEditor);

    container.append(topBar, fileTreeAndEditor);

    const autoRun = (installingPackages: Map<string, any>) => {
        if (!autoRunning) return;
        if (installingPackages.size === 0) {
            autoRunning = false;
            build(project);
        }
    };
    Store.packages.installingPackages.subscribe(autoRun);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: () => {
            Store.packages.installingPackages.unsubscribe(autoRun);
            topBar.destroy();
            fileTreeAndEditor.destroy();
            container.destroy();
        }
    });

    if (run) {
        runFn();
    }

    return container;
}

function TopBar(project: ProjectType, fileTreeAndEditor: HTMLElement) {
    const actions: ElementComponent[] = [];

    let gitWidget: ReturnType<typeof GitWidget>;
    if (project.id === "node_modules") {
        const deleteAllButton = Button({
            text: "Delete All",
            color: "red"
        });
        deleteAllButton.id = DELETE_ALL_PACKAGES_ID;

        deleteAllButton.onclick = async () => {
            deleteAllButton.disabled = true;
            await fs.rmdir("node_modules");
            await fs.mkdir("node_modules");
            stackNavigation.back();
        };

        actions.push(deleteAllButton);
    } else {
        gitWidget = GitWidget(project);

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

        const runButton = Button({
            style: "icon-large",
            iconLeft: "Play"
        });
        runButton.id = RUN_PROJECT_ID;

        runFn = async () => {
            const loaderContainer = document.createElement("div");
            loaderContainer.classList.add("loader-container");
            loaderContainer.append(Loader());
            runButton.replaceWith(loaderContainer);
            await build(project);
            loaderContainer.replaceWith(runButton);
        };
        runButton.onclick = runFn;

        actions.push(gitWidget, tsButton, runButton);
    }

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

async function build(project: ProjectType) {
    Store.editor.codeEditor.clearAllBuildErrors();

    await Promise.all([saveAllViews(), fs.rmdir(project.id + "/.build")]);

    const buildErrorsSASS = await buildSASS(project);
    const buildErrorsEsbuild = await esbuild.build(project);

    const buildErrors = [buildErrorsSASS, ...(buildErrorsEsbuild || [])]
        .flat()
        .filter(Boolean);

    if (buildErrors?.length) {
        autoRunning = true;
        buildErrors.forEach((error) => {
            if (!error?.location) return;
            Store.editor.codeEditor.addBuildError({
                file: error.location.file,
                line: error.location.line,
                col: error.location.column,
                length: error.location.length,
                message: error.text
            });
        });
    } else {
        autoRunning = false;
        core_open(project.id);
    }
}

async function buildSASS(project: ProjectType): Promise<Partial<Message>> {
    const writeOutputCSS = async (css: string) => {
        const buildDirectory = `${project.id}/.build`;
        await fs.mkdir(buildDirectory);
        await fs.writeFile(buildDirectory + "/index.css", css);
    };

    const contents = await fs.readdir(project.id);
    const entryPointSASS = contents.find(
        (item) => item === "index.sass" || item === "index.scss"
    );

    // check for css file and write to output
    // esbuild will pick it up and merge with css in js
    if (!entryPointSASS) {
        const entryPointCSS = contents.find((item) => item === "index.css");
        if (entryPointCSS) {
            // TODO: fs.copyFile
            await writeOutputCSS(
                await fs.readFile(`${project.id}/${entryPointCSS}`, {
                    encoding: "utf8"
                })
            );
        } else {
            await writeOutputCSS("");
        }

        return;
    }

    const entryData = await fs.readFile(`${project.id}/${entryPointSASS}`, {
        encoding: "utf8"
    });
    let result: sass.CompileResult;
    try {
        result = await sass.compileStringAsync(entryData, {
            importer: {
                load: async (url) => {
                    const filePath = `${project.id}${url.pathname}`;
                    const contents = await fs.readFile(filePath, {
                        encoding: "utf8"
                    });
                    return {
                        syntax: filePath.endsWith(".sass")
                            ? "indented"
                            : filePath.endsWith(".scss")
                              ? "scss"
                              : "css",
                        contents
                    };
                },
                canonicalize: (path) => new URL(path, window.location.href)
            }
        });
    } catch (e) {
        const error = e as unknown as sass.Exception;
        const file = error.span.url?.pathname || entryPointSASS;
        const line = error.span.start.line + 1;
        const column = error.span.start.column;
        const length = error.span.text.length;
        return {
            text: error.message,
            location: {
                file,
                line,
                column,
                length,
                namespace: "SASS",
                lineText: error.message,
                suggestion: ""
            }
        };
    }

    await writeOutputCSS(result.css);
    return null;
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
