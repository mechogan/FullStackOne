import api from "../../api";
import rpc from "../../rpc";
import type { Project as ProjectType } from "../../api/config/types";
import { Loader } from "../../components/loader";
import { Button } from "../../components/primitives/button";
import { Icon } from "../../components/primitives/icon";
import { TopBar } from "../../components/top-bar";
import { WorkerTS } from "../../typescript";
import { CodeEditor, FileError } from "./code-editor";
import { Editor } from "./editor";
import { FileTree } from "./file-tree";
import { Git } from "./git";
import type esbuild from "esbuild";
import { packageInstaller } from "../packages/installer";
import { DELETE_ALL_PACKAGES_ID, PROJECT_VIEW_ID, RUN_PROJECT_ID } from "../../constants";

type ProjectOpts = {
    project: ProjectType;
    didUpdateProject: () => void;

    // to directly run from deeplink
    run?: boolean;

    // only for packages view
    didDeleteAllPackages?: () => void;
};

export function Project(opts: ProjectOpts) {
    const container = document.createElement("div");
    container.id = PROJECT_VIEW_ID;
    container.classList.add("view");

    const fileTree = FileTree({
        directory: opts.project.location,
        onClosePanel: () => {
            content.classList.add("closed-panel");
        }
    });

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
    tsButton.onclick = WorkerTS.restart;

    const runButton = Button({
        style: "icon-large",
        iconLeft: "Play"
    });
    runButton.id = RUN_PROJECT_ID;
    runButton.onclick = async () => {
        const loaderContainer = document.createElement("div");
        loaderContainer.classList.add("loader-container");
        loaderContainer.append(Loader());
        runButton.replaceWith(loaderContainer);

        await run({ project: opts.project });

        loaderContainer.replaceWith(runButton);
    };

    const pullEvents: PullEvents = {
        start: null,
        end: null
    };
    const gitWidget = GitWidget({
        project: opts.project,
        didUpdateProject: opts.didUpdateProject,
        fileTree,
        pullEvents
    });

    const isPackagesView =
        opts.project.id === "packages" && opts.project.createdDate === null;
    const deleteAllButton = Button({
        text: "Delete All",
        color: "red"
    });
    deleteAllButton.id = DELETE_ALL_PACKAGES_ID;
    deleteAllButton.onclick = async () => {
        deleteAllButton.disabled = true;
        await rpc().fs.rmdir(opts.project.location, {
            absolutePath: true
        });
        opts.didDeleteAllPackages();
    };

    const topBar = TopBar({
        title: opts.project.title,
        subtitle: opts.project.id,
        actions: isPackagesView
            ? [deleteAllButton]
            : [gitWidget, tsButton, runButton],
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

    content.append(
        fileTree.container,
        Editor({
            directory: opts.project.location
        })
    );
    container.append(content);

    pullEvents.start?.();
    api.git.pull(opts.project).then(() => {
        pullEvents.end?.();
        CodeEditor.reloadActiveFilesContent();
        fileTree.reloadFileTree();
    });

    if (opts.run) {
        setTimeout(() => runButton.click(), 1);
    }

    return container;
}

type PullEvents = {
    start: () => void;
    end: () => void;
};

type GitWidgetOpts = {
    project: ProjectType;
    didUpdateProject: ProjectOpts["didUpdateProject"];
    fileTree: ReturnType<typeof FileTree>;
    pullEvents: PullEvents;
    statusArrow?: ReturnType<typeof Icon>;
};

function GitWidget(opts: GitWidgetOpts) {
    const container = document.createElement("div");
    container.classList.add("git-widget");

    const renderBranchAndCommit = () => {
        const branchAndCommitContainer = document.createElement("div");

        Promise.all([
            api.git.currentBranch(opts.project),
            api.git.log(opts.project, 1)
        ]).then(([branch, commit]) => {
            branchAndCommitContainer.innerHTML = `
                <div><b>${branch}</b></div>
                <div>${commit.at(0).oid.slice(0, 7)}<div>
            `;
        });

        return branchAndCommitContainer;
    };

    let branchAndCommit: ReturnType<typeof renderBranchAndCommit>;
    const reloadBranchAndCommit = () => {
        const updatedBranchAndCommit = renderBranchAndCommit();
        if (branchAndCommit) {
            branchAndCommit.replaceWith(updatedBranchAndCommit);
        } else {
            container.prepend(updatedBranchAndCommit);
        }
        branchAndCommit = updatedBranchAndCommit;
    };

    const gitButton = Button({
        style: "icon-large",
        iconLeft: "Git"
    });
    gitButton.disabled = true;
    api.git
        .currentBranch(opts.project)
        .then(() => {
            gitButton.disabled = false;
            reloadBranchAndCommit();
        })
        .catch(() => {});

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
                    opts.didUpdateProject();
                },
                didUpdateFiles: () => opts.fileTree.reloadFileTree(),
                didChangeCommitOrBranch: reloadBranchAndCommit,
                didPushEvent: (event) => {
                    if (event === "start") {
                        opts.statusArrow.style.display = "flex";
                        opts.statusArrow.classList.add("red");
                    } else {
                        opts.statusArrow.style.display = "none";
                    }
                }
            });
        };

        reloadGit();
    };

    container.append(gitButton);

    if (!opts.statusArrow) {
        opts.statusArrow = Icon("Arrow 2");
        opts.statusArrow.classList.add("git-status-arrow");
        opts.statusArrow.style.display = "none";
    }
    container.append(opts.statusArrow);

    opts.pullEvents.start = () => {
        opts.statusArrow.style.display = "flex";
        opts.statusArrow.classList.remove("red");
    };
    opts.pullEvents.end = () => {
        opts.statusArrow.style.display = "none";
    };

    container.append(opts.statusArrow);

    return container;
}

type runOpts = {
    project: ProjectType;
};

async function run(opts: runOpts) {
    await CodeEditor.saveAllActiveFiles();
    CodeEditor.clearAllErrors();

    const errors = await api.projects.build(opts.project);

    if (errors.length) {
        const { missingPackages, fileErrors } = processBuildErrors({
            project: opts.project,
            errors
        });
        if (missingPackages.size) {
            await Promise.all(
                Array.from(missingPackages).map(packageInstaller.install)
            );
            return run(opts);
        } else {
            for (const [path, errors] of fileErrors) {
                CodeEditor.addBuildFileErrors({ path, errors });
            }
        }
    } else {
        rpc().run(opts.project);
    }
}

type processBuildErrorsOpts = {
    project: ProjectType;
    errors: Partial<esbuild.Message>[];
};

function processBuildErrors(opts: processBuildErrorsOpts) {
    const processedErrors = opts.errors.map((error) =>
        processBuildError({
            project: opts.project,
            error
        })
    );

    const missingPackages = new Set<string>();
    const fileErrors = new Map<string, FileError[]>();
    processedErrors.forEach((error) => {
        switch (error.type) {
            case "missingPackage":
                missingPackages.add(error.packageName);
                break;
            case "fileError":
                let errorsForFile = fileErrors.get(error.path);
                if (!errorsForFile) {
                    errorsForFile = [];
                    fileErrors.set(error.path, errorsForFile);
                }
                errorsForFile.push(error.fileError);
        }
    });

    return { missingPackages, fileErrors };
}

type processErrorOpts = {
    project: ProjectType;
    error: Partial<esbuild.Message>;
};

function processBuildError(opts: processErrorOpts):
    | {
          type: "missingPackage";
          packageName: string;
      }
    | {
          type: "fileError";
          path: string;
          fileError: FileError;
      } {
    const file = opts.error.location?.file;

    if (!file) {
        console.log(opts.error);
        return;
    }

    const message = opts.error.text;

    if (message.startsWith("Could not resolve")) {
        const packageName: string = message
            .match(/\".*\"/)
            ?.at(0)
            ?.slice(1, -1);

        if (!packageName.startsWith(".")) {
            return {
                type: "missingPackage",
                packageName
            };
        }
    }

    const filePath = file.split(opts.project.location).pop();
    const path = opts.project.location + filePath;

    return {
        type: "fileError",
        path,
        fileError: {
            line: opts.error.location?.line,
            col: opts.error.location?.column,
            length: opts.error.location?.length,
            message
        }
    };
}
