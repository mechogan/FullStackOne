import "./index.css";

import { Editor } from "../editor";
import { FileTree } from "../file-tree";
import { Console } from "../console";

import type { Project as TypeProject } from "../../../api/projects/types";
import type typeRPC from "../../../../src/webview";
import type api from "../../../api";
import { DELETE_ALL_PACKAGES_ID, RUN_PROJECT_ID } from "../../../constants";

declare var rpc: typeof typeRPC<typeof api>;

export class Project {
    backAction: () => void;
    packagesView: boolean = false;

    private container: HTMLDivElement;
    private project: TypeProject;

    fileTree: {
        instance: FileTree;
        element: Awaited<ReturnType<FileTree["render"]>> | null;
    } = {
        instance: new FileTree(),
        element: null
    };
    console = new Console();

    private tabsContainer = document.createElement("ul");
    private editorsContainer = document.createElement("div");

    private currentFile: string;
    private editors: Editor[] = [];

    constructor() {
        this.fileTree.instance.onItemSelect = (item) => {
            if (!item || item.isDirectory) return;

            const joinedPath = item.path.join("/");
            if (
                !this.editors.find(
                    ({ filePath }) => filePath.join("/") === joinedPath
                )
            ) {
                this.editors.push(new Editor(item.path));
            }

            this.currentFile = joinedPath;

            this.renderEditors();
        };

        (window as any).onPush["buildError"] = (message: string) => {
            const errors = JSON.parse(message);

            const packagesMissing = new Map<string, Set<string>>();
            errors.forEach((error) => {
                const file = error.location?.file || error.Location?.File;

                const filename = file.split(this.project.location).pop();
                let filePath = this.project.location + filename;

                const message = error.text || error.Text;

                if (message.startsWith("Could not resolve")) {
                    const moduleName: string[] = message
                        .match(/\".*\"/)
                        ?.at(0)
                        ?.slice(1, -1)
                        .split("/");

                    if (!moduleName.at(0)?.startsWith(".")) {
                        const dependency = moduleName.at(0)?.startsWith("@")
                            ? moduleName.slice(0, 2).join("/")
                            : moduleName.at(0);

                        if (dependency) {
                            let fileRequiringPackage =
                                packagesMissing.get(dependency);
                            if (!fileRequiringPackage)
                                fileRequiringPackage = new Set();
                            fileRequiringPackage.add(
                                filename.includes("node_modules")
                                    ? "node_modules" +
                                          filename.split("node_modules").pop()
                                    : filename.slice(1)
                            );
                            packagesMissing.set(
                                dependency,
                                fileRequiringPackage
                            );
                        }

                        return;
                    }
                }

                let editor = this.editors.find(
                    (activeEditor) =>
                        activeEditor.filePath.join("/") === filePath
                );
                if (!editor) {
                    editor = new Editor(filePath.split("/"));
                    this.editors.push(editor);
                }

                editor.addBuildError({
                    line: error.location?.line || error.Location?.Line,
                    col: error.location?.column || error.Location?.Column,
                    length: error.location?.length || error.Location?.Length,
                    message
                });

                this.currentFile = filename;
            });

            this.renderEditors();

            if (packagesMissing.size > 0) {
                this.installPackages(packagesMissing);
            }
        };

        (window as any).onPush["download"] = async (message: string) => {
            const uint8Arr = new Uint8Array(
                (await rpc().fs.readFile(message)) as Uint8Array
            );
            const blob = new Blob([uint8Arr]);
            const url = window.URL.createObjectURL(blob);

            const element = document.createElement("a");
            element.setAttribute("href", url);
            element.setAttribute(
                "download",
                message.split("/").pop() ?? "unnamed.zip"
            );
            element.style.display = "none";

            document.body.appendChild(element);

            element.click();
            document.body.removeChild(element);
            window.URL.revokeObjectURL(url);
        };

        const openConsole = () => {
            this.console.fitAddon.fit();
            this.container.classList.add("console-opened");
            setTimeout(() => {
                this.console.fitAddon.fit();
            }, 350);
        };

        const writeParagraph = (contents: string) => {
            contents.split("\n").forEach((ln) => this.console.term.writeln(ln));
        };

        (window as any).onPush["log"] = (message: string) => {
            const logs = JSON.parse(message);
            if (logs.length) {
                openConsole();
            }
            const str = logs
                .map((log) =>
                    typeof log === "string" ? log : JSON.stringify(log, null, 2)
                )
                .join("  ");
            writeParagraph(str);
        };
        (window as any).onPush["error"] = (message: string) => {
            openConsole();
            const error: { message: string; name: string; stack: string } =
                JSON.parse(message);
            writeParagraph(error.message);
            writeParagraph(error.name);
            writeParagraph(error.stack);
        };
    }

    setProject(project: TypeProject) {
        if (project === this.project) return;

        this.project = project;
        this.fileTree.instance.setBaseDirectory(project.location);

        this.editors = [];
        this.renderEditors();
    }

    private installPackages(packagesToInstall: Map<string, Set<string>>) {
        const dialog = document.createElement("div");
        dialog.classList.add("dialog");

        const container = document.createElement("div");
        container.innerHTML = `<h1>Dependencies</h1>`;

        const packagesContainer = document.createElement("dl");
        const installPromises: Promise<void>[] = [];
        for (const [
            packageName,
            filesRequiringPackage
        ] of packagesToInstall.entries()) {
            const dt = document.createElement("dt");
            dt.innerText = packageName;
            const dd = document.createElement("dd");
            const ul = document.createElement("ul");
            for (const file of filesRequiringPackage) {
                const li = document.createElement("li");
                li.innerText = file;
                ul.append(li);
            }
            dd.append(ul);

            const status = document.createElement("div");
            status.innerText = "installing...";
            container.append(status);

            const installPromise = new Promise<void>((resolve) => {
                rpc()
                    .packages.install(packageName)
                    .then(() => {
                        status.innerText = "installed";
                        resolve();
                    });
            });
            installPromises.push(installPromise);

            packagesContainer.append(dt, dd, status);
        }

        container.append(packagesContainer);
        dialog.append(container);
        this.container.append(dialog);

        Promise.all(installPromises).then(() => {
            dialog.remove();
            this.runProject();
        });
    }

    private async runProject() {
        await Promise.all(
            this.editors.map((editor) => {
                editor.clearBuildErrors();
                return editor.updateFile();
            })
        );
        this.renderEditors();
        this.console.term.clear();
        rpc().projects.run(this.project);
    }

    private async renderTopRightActions() {
        const container = document.createElement("div");

        if (this.packagesView) {
            const deleteAllPackagesButton = document.createElement("button");
            deleteAllPackagesButton.id = DELETE_ALL_PACKAGES_ID;
            deleteAllPackagesButton.classList.add("danger", "text");
            deleteAllPackagesButton.innerText = "Delete All";
            deleteAllPackagesButton.addEventListener("click", async () => {
                await rpc().fs.rmdir(this.project.location);
                this.backAction();
            });
            container.append(deleteAllPackagesButton);
        } else {
            const shareButton = document.createElement("button");
            shareButton.classList.add("text");
            shareButton.innerHTML = await (
                await fetch("/assets/icons/share.svg")
            ).text();
            shareButton.addEventListener("click", async () => {
                await rpc().projects.zip(this.project);
                const refreshedFileTree = await this.fileTree.instance.render();
                this.fileTree.element?.replaceWith(refreshedFileTree);
                this.fileTree.element = refreshedFileTree;
            });
            container.append(shareButton);

            const runButton = document.createElement("button");
            runButton.id = RUN_PROJECT_ID;
            runButton.classList.add("text");
            runButton.innerHTML = await (
                await fetch("/assets/icons/run.svg")
            ).text();
            runButton.addEventListener("click", this.runProject.bind(this));
            container.append(runButton);
        }

        return container;
    }

    private async renderGitButton(pull = false) {
        const buttonContainer = document.createElement("button");
        buttonContainer.classList.add("text", "text-and-icon", "git-btn");

        const icon = await (await fetch("assets/icons/git.svg")).text();
        buttonContainer.innerHTML = icon;

        let pullLabel: HTMLDivElement;
        if (pull) {
            pullLabel = document.createElement("div");
            pullLabel.innerText = "Pulling...";
            buttonContainer.append(pullLabel);
        }

        setTimeout(
            async () => {
                if (pull) {
                    await rpc().git.pull(this.project);
                    pullLabel?.remove();
                }

                const [branch, commit] = await Promise.all([
                    rpc().git.currentBranch(this.project),
                    rpc().git.log(this.project, 1)
                ]);
                const currentBranch = branch || "DETACHED";
                const currentCommit = commit?.at(0)?.oid || "";

                buttonContainer.addEventListener("click", () =>
                    this.renderGitDialog(icon, currentBranch, currentCommit)
                );

                const branchContainer = document.createElement("div");
                branchContainer.innerText = currentBranch;
                buttonContainer.append(branchContainer);

                const commitContainer = document.createElement("div");
                commitContainer.innerText = currentCommit.slice(0, 7);
                buttonContainer.append(commitContainer);
            },
            pull ? 500 : 1
        );

        return buttonContainer;
    }

    private async renderGitDialog(
        icon: string,
        branch: string,
        commit: string
    ) {
        const dialog = document.createElement("div");
        dialog.classList.add("dialog");

        const container = document.createElement("div");
        container.classList.add("git-form");

        const gitInfo = document.createElement("header");
        const remote = this.project.gitRepository.url;
        gitInfo.innerHTML = `
            ${icon}
            <a href="${remote}" target="_blank">${remote.slice(0, -".git".length)}</a>
            <div>${branch}</div>
            <div>${commit}</div>`;

        container.append(gitInfo);

        const authorContainer = document.createElement("div");
        authorContainer.classList.add("author");
        container.append(authorContainer);

        const [userIcon, editIcon, checkIcon] = await Promise.all([
            (await fetch("assets/icons/user.svg")).text(),
            (await fetch("assets/icons/edit.svg")).text(),
            (await fetch("assets/icons/check.svg")).text()
        ]);

        const renderAuthorInputs = () => {
            authorContainer.innerHTML = `
                ${userIcon}`;

            const usernameContainer = document.createElement("div");

            const nameLabel = document.createElement("label");
            nameLabel.innerText = "Name";
            usernameContainer.append(nameLabel);

            const nameInput = document.createElement("input");
            nameInput.value = this.project.gitRepository.name || "";
            usernameContainer.append(nameInput);

            authorContainer.append(usernameContainer);

            const emailContainer = document.createElement("div");

            const emailInputLabel = document.createElement("label");
            emailInputLabel.innerText = "Email";
            emailContainer.append(emailInputLabel);

            const emailInput = document.createElement("input");
            emailInput.value = this.project.gitRepository.email || "";
            emailInput.type = "email";
            emailContainer.append(emailInput);

            authorContainer.append(emailContainer);

            const confirmButton = document.createElement("button");
            confirmButton.addEventListener("click", () => {
                this.project.gitRepository.name = nameInput.value;
                this.project.gitRepository.email = emailInput.value;
                renderAuthorInfo();
                rpc().projects.update(this.project);
            });
            confirmButton.classList.add("small", "text");
            confirmButton.innerHTML = checkIcon;
            authorContainer.append(confirmButton);
        };

        const renderAuthorInfo = async () => {
            authorContainer.innerHTML = `
                ${userIcon}
                <div>${this.project.gitRepository.name || "<b>No username</b>"}</div>
                <div>${this.project.gitRepository.email || "<b>No email</b>"}</div>`;

            const editButton = document.createElement("button");
            editButton.addEventListener("click", () => {
                renderAuthorInputs();
            });
            editButton.classList.add("small", "text");
            editButton.innerHTML = editIcon;
            authorContainer.append(editButton);
        };

        if (
            this.project.gitRepository.name ||
            this.project.gitRepository.email
        ) {
            await renderAuthorInfo();
        } else {
            renderAuthorInputs();
        }

        const confirmButton = document.createElement("button");
        const changesContainer = document.createElement("div");
        changesContainer.classList.add("changes");
        changesContainer.innerText = "Calculating diffs...";
        container.append(changesContainer);

        const getChanges = async () => {
            const changes = await rpc().git.changes(this.project);
            changesContainer.innerText = "";

            const hasChanges = Object.values(changes).some(
                (arr) => arr.length !== 0
            );

            if (!hasChanges) {
                changesContainer.innerHTML = `<h3>No changes</h3>`;
            } else {
                Object.entries(changes).forEach(([status, files]) => {
                    if (files.length === 0) return;

                    const subtitle = document.createElement("h3");
                    subtitle.innerText =
                        status.at(0).toUpperCase() + status.slice(1);
                    changesContainer.append(subtitle);

                    const ul = document.createElement("ul");
                    const lis = files.map((file) => {
                        const li = document.createElement("li");
                        li.innerText = file;
                        return li;
                    });
                    ul.append(...lis);
                    changesContainer.append(ul);
                });

                const commitMessageInputLabel = document.createElement("label");
                commitMessageInputLabel.innerText = "Commit Message";
                changesContainer.append(commitMessageInputLabel);

                const commitMessageInput = document.createElement("input");
                changesContainer.append(commitMessageInput);

                confirmButton.disabled = false;
                confirmButton.addEventListener("click", async () => {
                    await rpc().git.push(
                        this.project,
                        commitMessageInput.value
                    );
                    dialog.remove();
                    const gitButton = this.container.querySelector(".git-btn");
                    gitButton.replaceWith(await this.renderGitButton());
                });
            }
        };

        const buttonGroup = document.createElement("div");

        const cancelButton = document.createElement("button");
        cancelButton.classList.add("text");
        cancelButton.innerText = "Close";
        cancelButton.addEventListener("click", () => {
            dialog.remove();
        });
        buttonGroup.append(cancelButton);

        confirmButton.disabled = true;
        confirmButton.innerText = "Push";
        buttonGroup.append(confirmButton);

        container.append(buttonGroup);

        dialog.append(container);
        this.container.append(dialog);

        setTimeout(getChanges, 500);
    }

    private async renderToolbar() {
        const container = document.createElement("div");
        container.classList.add("top-bar");

        const leftSide = document.createElement("div");

        const backButton = document.createElement("button");
        backButton.innerHTML = await (
            await fetch("/assets/icons/arrow-left.svg")
        ).text();
        backButton.classList.add("text");
        backButton.addEventListener("click", this.backAction);
        leftSide.append(backButton);

        const fileTreeToggle = document.createElement("button");
        fileTreeToggle.innerHTML = await (
            await fetch("/assets/icons/side-panel.svg")
        ).text();
        fileTreeToggle.classList.add("text");
        fileTreeToggle.addEventListener("click", () => {
            this.container.classList.toggle("side-panel-closed");
            setTimeout(() => {
                this.console.fitAddon.fit();
            }, 350);
        });
        leftSide.append(fileTreeToggle);

        const projectTitle = document.createElement("h3");
        projectTitle.innerText = this.project.title;
        leftSide.append(projectTitle);

        if (this.project.gitRepository) {
            leftSide.append(await this.renderGitButton(true));
        }

        container.append(leftSide);

        const rightSide = await this.renderTopRightActions();
        container.append(rightSide);

        return container;
    }

    renderEditors() {
        Array.from(this.editorsContainer.children).forEach((child) =>
            child.remove()
        );

        const tabsContainer = document.createElement("ul");
        tabsContainer.classList.add("tabs-container");

        this.editors.forEach(async (editor, index) => {
            const tab = document.createElement("li");
            if (editor.hasBuildErrors()) {
                tab.classList.add("has-errors");
            }
            tab.innerText = editor.filePath.at(-1) || "file";
            tab.addEventListener("click", () => {
                this.currentFile = editor.filePath.join("/");
                this.renderEditors();
            });

            const removeBtn = document.createElement("button");
            removeBtn.classList.add("text", "small");
            removeBtn.innerHTML = await (
                await fetch("/assets/icons/close.svg")
            ).text();
            removeBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                await editor.updateFile();
                this.editors.splice(index, 1);
                this.renderEditors();
            });
            tab.append(removeBtn);

            tabsContainer.append(tab);

            if (editor.filePath.join("/") === this.currentFile) {
                tab.classList.add("active");
                this.editorsContainer.append(await editor.render());
            }
        });

        this.tabsContainer.replaceWith(tabsContainer);
        this.tabsContainer = tabsContainer;
    }

    async renderConsole() {
        const consoleContainer = document.createElement("div");
        consoleContainer.classList.add("console");
        consoleContainer.append(this.console.render());

        const toggleConsoleButton = document.createElement("button");
        toggleConsoleButton.classList.add("text");
        toggleConsoleButton.innerHTML = await (
            await fetch("assets/icons/caret-down.svg")
        ).text();
        toggleConsoleButton.addEventListener("click", () => {
            this.container.classList.toggle("console-opened");
            setTimeout(() => {
                this.console.fitAddon.fit();
            }, 350);
        });
        consoleContainer.append(toggleConsoleButton);
        return consoleContainer;
    }

    async render() {
        this.container = document.createElement("div");
        this.container.classList.add("project");

        this.container.append(await this.renderToolbar());

        const fileTreeContainer = document.createElement("div");
        fileTreeContainer.classList.add("left-sidebar");
        this.fileTree.instance.allowDeletion = true;
        this.fileTree.instance.noNewItems = this.packagesView;
        this.fileTree.element = await this.fileTree.instance.render();
        fileTreeContainer.append(this.fileTree.element);
        this.container.append(fileTreeContainer);

        this.tabsContainer.classList.add("tabs-container");
        this.container.append(this.tabsContainer);

        this.editorsContainer.classList.add("editor-container");
        this.container.append(this.editorsContainer);

        this.container.append(await this.renderConsole());

        return this.container;
    }
}
