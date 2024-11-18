import type { Project as ProjectType } from "../../types";
import { BG_COLOR, PROJECT_VIEW_ID } from "../../constants";
import stackNavigation from "../../stack-navigation";
import { TopBar as TopBarComponent } from "../../components/top-bar";
import { Button } from "../../components/primitives/button";
import { FileTree } from "./file-tree";
import { Store } from "../../store";
import { createElement, ElementComponent } from "../../components/element";
import { Editor } from "./editor";
import { WorkerTS } from "../../typescript";
import { ipcEditor } from "../../ipc";
import { Loader } from "../../components/loader";
import * as sass from "sass";
import type { Message } from "esbuild";
import { saveAllViews } from "./code-editor";

let lastOpenedProjectId: string,
    autoRunning = false;
export function Project(project: ProjectType) {
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

    return container;
}

function TopBar(project: ProjectType, fileTreeAndEditor: HTMLElement) {
    const actions: ElementComponent[] = [];

    if (project.id === "node_modules") {
        const deleteAllButton = Button({
            text: "Delete All",
            color: "red"
        });

        deleteAllButton.onclick = async () => {
            deleteAllButton.disabled = true;
            await ipcEditor.fs.rmdir("node_modules");
            await ipcEditor.fs.mkdir("node_modules");
            stackNavigation.back();
        };

        actions.push(deleteAllButton);
    } else {
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

        runButton.onclick = async () => {
            const loaderContainer = document.createElement("div");
            loaderContainer.classList.add("loader-container");
            loaderContainer.append(Loader());
            runButton.replaceWith(loaderContainer);
            await build(project);
            loaderContainer.replaceWith(runButton);
        };

        actions.push(gitButton, tsButton, runButton);
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
    await saveAllViews();
    const buildErrors = (
        await Promise.all([
            buildSASS(project),
            ipcEditor.esbuild.build(project)
        ])
    )
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
        ipcEditor.open(project.id);
    }
}

async function buildSASS(project: ProjectType): Promise<Partial<Message>> {
    const contents = await ipcEditor.fs.readdir(project.id);
    const entryPoint = contents.find(
        (item) => item === "index.sass" || item === "index.scss"
    );
    if (!entryPoint) return null;

    const entryData = await ipcEditor.fs.readFile(
        `${project.id}/${entryPoint}`,
        { encoding: "utf8" }
    );
    let result: sass.CompileResult;
    try {
        result = await sass.compileStringAsync(entryData, {
            importer: {
                load: async (url) => {
                    const filePath = `${project.id}${url.pathname}`;
                    const contents = await ipcEditor.fs.readFile(filePath, {
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
        const file = error.span.url?.pathname || entryPoint;
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

    const buildDirectory = `${project.id}/.build`;
    await ipcEditor.fs.mkdir(buildDirectory);
    await ipcEditor.fs.writeFile(buildDirectory + "/index.css", result.css);
    return null;
}
