import "./index.css";

import type { Project as TypeProject } from "../../../api/projects/types";
import api from "../../../api";

export default class GitWidget {
    reloadContent: () => void;
    openFiles: (filepaths: string[]) => void;
    parentContainer: HTMLDivElement;
    project: TypeProject;
    merging: {
        theirs: string;
        filepaths: string[];
    };

    btn: HTMLButtonElement;

    constructor(
        reloadContent: GitWidget["reloadContent"],
        openFiles: GitWidget["openFiles"]
    ) {
        this.reloadContent = reloadContent;
        this.openFiles = openFiles;
    }

    private async getCurrentBranchAndCommit() {
        const [branch, commit] = await Promise.all([
            api.git.currentBranch(this.project),
            api.git.log(this.project, 1)
        ]);

        return {
            branch: branch || "DETACHED",
            commit: commit?.at(0)?.oid || ""
        };
    }

    private async renderBranches(backAction: () => void) {
        const container = document.createElement("div");
        container.classList.add("branches");

        const top = document.createElement("div");

        const leftSide = document.createElement("div");

        const backButton = document.createElement("button");
        backButton.classList.add("text");
        backButton.addEventListener("click", backAction);
        backButton.innerHTML = await (
            await fetch("assets/icons/chevron.svg")
        ).text();
        leftSide.append(backButton);

        const title = document.createElement("h3");
        title.innerText = "Branches";
        leftSide.append(title);
        top.append(leftSide);

        const createBranchButton = document.createElement("button");
        createBranchButton.innerText = "Create";
        top.append(createBranchButton);

        container.append(top);

        const [arrow, check, close, deleteIcon] = await Promise.all([
            (await fetch("assets/icons/arrow.svg")).text(),
            (await fetch("assets/icons/check.svg")).text(),
            (await fetch("assets/icons/close.svg")).text(),
            (await fetch("assets/icons/delete.svg")).text()
        ]);

        const renderBranchForm = () => {
            createBranchButton.disabled = true;

            const form = document.createElement("form");

            const branchNameLabel = document.createElement("label");
            branchNameLabel.innerText = "Branch Name";
            form.append(branchNameLabel);

            const branchNameInput = document.createElement("input");
            form.append(branchNameInput);

            const buttonGroup = document.createElement("div");
            buttonGroup.classList.add("button-group");

            const confirmButton = document.createElement("button");
            confirmButton.classList.add("text");
            confirmButton.innerHTML = check;
            buttonGroup.append(confirmButton);

            const cancelButton = document.createElement("button");
            cancelButton.classList.add("text", "danger");
            cancelButton.innerHTML = close;
            buttonGroup.append(cancelButton);

            cancelButton.addEventListener("click", () => {
                form.remove();
                createBranchButton.disabled = false;
            });

            form.addEventListener("submit", async (e) => {
                e.preventDefault();
                form.innerHTML = `Creating <b>${branchNameInput.value}</b> branch...`;
                await api.git.branch.create(
                    this.project,
                    branchNameInput.value
                );
                form.remove();
                createBranchButton.disabled = false;
                container
                    .querySelector("ul")
                    .replaceWith(await renderBranchList());
                this.btn.replaceWith(await this.renderButton());
            });

            form.append(buttonGroup);

            return form;
        };

        const formContainer = document.createElement("div");
        container.append(formContainer);

        createBranchButton.addEventListener("click", () => {
            formContainer.append(renderBranchForm());
        });

        const alertContainer = document.createElement("div");
        container.append(alertContainer);

        const renderBranchList = async () => {
            const [currentBranch, branches, { changes, unreacheable }] =
                await Promise.all([
                    api.git.currentBranch(this.project),
                    api.git.branch.getAll(this.project),
                    api.git.changes(this.project)
                ]);

            const hasUncommittedChanges = Object.values(changes).some(
                (files) => files.length > 0
            );
            if (hasUncommittedChanges) {
                alertContainer.innerHTML = `<p class="alert">${await (await fetch("assets/icons/alert.svg")).text()}
                    You have uncommited changes.</p>`;
            }

            const ul = document.createElement("ul");
            new Set(Object.values(branches).flat()).forEach((branch) => {
                if (branch === "HEAD") return;

                const li = document.createElement("li");

                const branchIsLocalOnly =
                    branches.local.includes(branch) &&
                    !branches.remote.includes(branch);
                const branchIsRemoteOnly =
                    !branches.local.includes(branch) &&
                    branches.remote.includes(branch);

                if (branch === currentBranch) {
                    const arrowContainer = document.createElement("span");
                    arrowContainer.innerHTML = arrow;
                    li.append(arrowContainer);
                } else if (!branchIsRemoteOnly) {
                    const deleteButton = document.createElement("button");
                    deleteButton.classList.add("text", "danger", "small");
                    deleteButton.innerHTML = deleteIcon;
                    deleteButton.addEventListener("click", async () => {
                        await api.git.branch.delete(this.project, branch);
                        li.remove();
                        ul.replaceWith(await renderBranchList());
                    });
                    li.append(deleteButton);
                } else {
                    li.append(document.createElement("div"));
                }

                const branchName = document.createElement("div");
                branchName.innerText = branch;
                li.append(branchName);

                // local only branch
                if (branchIsLocalOnly) {
                    const localLabel = document.createElement("div");
                    localLabel.innerText = "local-only";
                    li.append(localLabel);
                } else if (branchIsRemoteOnly) {
                    const remoteLabel = document.createElement("div");
                    remoteLabel.innerText = "remote-only";
                    li.append(remoteLabel);
                }

                if (!hasUncommittedChanges && branch !== currentBranch) {
                    const checkoutButton = document.createElement("button");
                    checkoutButton.classList.add("text");
                    checkoutButton.innerText = "Checkout";
                    checkoutButton.addEventListener("click", () => {
                        checkoutButton.disabled = true;
                        checkoutButton.innerText = "Checking out...";
                        setTimeout(async () => {
                            await api.git.checkout(this.project, branch);
                            ul.replaceWith(await renderBranchList());
                            this.btn.replaceWith(
                                await this.renderButton(!branchIsLocalOnly)
                            );
                            this.reloadContent();
                        }, 100);
                    });
                    li.append(checkoutButton);
                }

                ul.append(li);
            });

            return ul;
        };

        setTimeout(async () => container.append(await renderBranchList()), 200);

        return container;
    }

    private async renderDialog(
        icon: string,
        branch: string,
        commit: string,
        elements?: { dialog: HTMLDivElement; container: HTMLDivElement }
    ) {
        const dialog = elements?.dialog || document.createElement("div");
        dialog.classList.add("dialog");

        const [userIcon, editIcon, closeIcon, checkIcon, branchIcon] =
            await Promise.all([
                (await fetch("assets/icons/user.svg")).text(),
                (await fetch("assets/icons/edit.svg")).text(),
                (await fetch("assets/icons/close.svg")).text(),
                (await fetch("assets/icons/check.svg")).text(),
                (await fetch("assets/icons/git-branch.svg")).text()
            ]);

        const container = elements?.container || document.createElement("div");
        container.classList.add("git-dialog");

        const gitInfo = document.createElement("header");
        const remote = this.project.gitRepository.url;
        gitInfo.innerHTML = `
            ${icon}
            <a href="${remote}" target="_blank">${remote.slice(0, -".git".length)}</a>
            <div>${branch}</div>
            <div>${commit}</div>`;

        const branchButton = document.createElement("button");
        branchButton.classList.add("text");
        branchButton.innerHTML = branchIcon;
        branchButton.addEventListener("click", async () => {
            container.innerHTML = "";
            const rerenderDialog = async () => {
                const { branch, commit } =
                    await this.getCurrentBranchAndCommit();
                container.innerHTML = "";
                this.renderDialog(icon, branch, commit, { container, dialog });
            };
            container.append(await this.renderBranches(rerenderDialog));
        });
        gitInfo.append(branchButton);

        container.append(gitInfo);

        const authorContainer = document.createElement("div");
        authorContainer.classList.add("author");
        container.append(authorContainer);

        const renderAuthorInputs = async () => {
            authorContainer.innerHTML = `
                ${userIcon}`;

            const form = document.createElement("form");

            if (!this.project.gitRepository.name) {
                const alert = document.createElement("p");
                alert.classList.add("alert");
                alert.innerHTML = `${await (await fetch("assets/icons/alert.svg")).text()}
                    No git user.name`;
                form.append(alert);
            }

            const nameLabel = document.createElement("label");
            nameLabel.innerText = "Name";
            form.append(nameLabel);

            const nameInput = document.createElement("input");
            nameInput.value = this.project.gitRepository.name || "";
            form.append(nameInput);

            const emailInputLabel = document.createElement("label");
            emailInputLabel.innerText = "Email";
            form.append(emailInputLabel);

            const emailInput = document.createElement("input");
            emailInput.value = this.project.gitRepository.email || "";
            emailInput.type = "email";
            form.append(emailInput);

            const buttonGroup = document.createElement("div");
            buttonGroup.classList.add("button-group");

            const confirmButton = document.createElement("button");
            confirmButton.classList.add("text");
            confirmButton.addEventListener("click", async () => {
                this.project.gitRepository.name = nameInput.value;
                this.project.gitRepository.email = emailInput.value;
                renderAuthorInfo();
                await api.projects.update(this.project);
                this.btn.replaceWith(await this.renderButton());
            });
            confirmButton.innerHTML = checkIcon;
            buttonGroup.append(confirmButton);

            if (this.project.gitRepository.name) {
                const cancelButton = document.createElement("button");
                cancelButton.classList.add("text", "danger");
                cancelButton.addEventListener("click", () => {
                    renderAuthorInfo();
                });
                cancelButton.innerHTML = closeIcon;
                buttonGroup.append(cancelButton);
            } else {
                const filler = document.createElement("div");
                buttonGroup.append(filler);
            }

            form.append(buttonGroup);

            authorContainer.append(form);
        };

        const renderAuthorInfo = async () => {
            authorContainer.innerHTML = `
                ${userIcon}
                <div>
                    <div>${this.project.gitRepository.name || "<b>No username</b>"}</div>
                    <div>${this.project.gitRepository.email || "<b>No email</b>"}</div>
                </div>`;

            const editButton = document.createElement("button");
            editButton.addEventListener("click", () => renderAuthorInputs());
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
            await renderAuthorInputs();
        }

        const commitButton = document.createElement("button");
        commitButton.classList.add("text");
        const commitAndPushButton = document.createElement("button");

        const changesContainer = document.createElement("div");
        changesContainer.classList.add("changes");
        changesContainer.innerText = "Calculating diffs...";
        container.append(changesContainer);

        const buttonGroup = document.createElement("div");
        buttonGroup.classList.add("button-group");

        const cancelButton = document.createElement("button");
        cancelButton.classList.add("text");
        cancelButton.innerText = "Close";
        cancelButton.addEventListener("click", () => {
            dialog.remove();
        });
        buttonGroup.append(cancelButton);

        const subButtonGroup = document.createElement("div");
        subButtonGroup.classList.add("button-group");
        commitButton.innerText = "Commit";
        commitAndPushButton.disabled = true;
        commitAndPushButton.innerText = "Push";
        subButtonGroup.append(commitAndPushButton);
        buttonGroup.append(subButtonGroup);

        container.append(buttonGroup);

        dialog.append(container);

        if (!elements) this.parentContainer.append(dialog);

        const getChanges = async () => {
            const { changes, unreacheable } = await api.git.changes(
                this.project
            );
            changesContainer.innerText = "";

            if (unreacheable) {
                const alert = document.createElement("p");
                alert.classList.add("alert");
                alert.innerHTML = `${await (await fetch("assets/icons/alert.svg")).text()}
                    Remote is unreacheable`;
                changesContainer.append(alert);
            }

            if (this.merging) {
                changes["merged"] = this.merging.filepaths;
            }

            const hasChanges = Object.values(changes).some(
                (arr) => arr.length !== 0
            );

            if (!hasChanges) {
                changesContainer.innerHTML = `<h3>No Changes</h3>`;
            } else {
                const revertIcon = await (
                    await fetch("assets/icons/revert.svg")
                ).text();

                subButtonGroup.prepend(commitButton);
                Object.entries(changes).forEach(([status, files]) => {
                    if (files.length === 0) return;

                    const subtitle = document.createElement("h3");
                    subtitle.innerText =
                        status.at(0).toUpperCase() + status.slice(1);
                    changesContainer.append(subtitle);

                    const ul = document.createElement("ul");
                    files.forEach((file) => {
                        const li = document.createElement("li");
                        li.innerHTML = `<span>${file}</span>`;

                        const revertButton = document.createElement("button");
                        revertButton.classList.add("text", "small");
                        revertButton.innerHTML = revertIcon;
                        revertButton.addEventListener("click", async () => {
                            await api.git.checkoutFile(
                                this.project,
                                branch,
                                [file],
                                true
                            );
                            changesContainer.innerText = "Calculating diffs...";
                            commitAndPushButton.disabled = true;
                            commitButton.remove();
                            this.reloadContent();
                            await getChanges();
                        });
                        li.append(revertButton);

                        ul.append(li);
                    });
                    changesContainer.append(ul);
                });

                const commitForm = document.createElement("form");

                const commitMessageInputLabel = document.createElement("label");
                commitMessageInputLabel.innerText = "Commit Message";
                commitForm.append(commitMessageInputLabel);

                const commitMessageInput = document.createElement("input");
                commitForm.append(commitMessageInput);

                const commitSubmit = document.createElement("button");
                commitForm.append(commitSubmit);

                changesContainer.append(commitForm);

                commitAndPushButton.disabled = unreacheable;

                const commit = async () => {
                    if (!commitMessageInput.value) return;

                    await api.git.commit(
                        this.project,
                        commitMessageInput.value,
                        this.merging
                    );

                    this.merging = undefined;
                };

                const commitAndPush = async () => {
                    await commit();
                    return api.git.push(this.project);
                };

                const commitButtonCb = async () => {
                    if (!commitMessageInput.value) return;

                    dialog.remove();
                    await commit();
                    this.btn.replaceWith(await this.renderButton());
                };

                const commitAndPushButtonCb = async () => {
                    if (!commitMessageInput.value) return;

                    dialog.remove();

                    const arrowIcon = await (
                        await fetch("assets/icons/arrow.svg")
                    ).text();

                    let pushIcon = document.createElement("div");
                    pushIcon.classList.add("push");
                    pushIcon.innerHTML = arrowIcon;
                    this.btn.prepend(pushIcon);

                    setTimeout(async () => {
                        await commitAndPush();
                        this.btn.replaceWith(await this.renderButton());
                    }, 500);
                };

                commitButton.addEventListener(
                    "click",
                    commitButtonCb.bind(this)
                );
                commitAndPushButton.addEventListener(
                    "click",
                    commitAndPushButtonCb.bind(this)
                );

                commitForm.addEventListener("submit", async (e) => {
                    e.preventDefault();
                    if (unreacheable) {
                        await commitButtonCb();
                    } else {
                        await commitAndPushButtonCb();
                    }
                });
            }
        };

        setTimeout(getChanges, 500);
    }

    renderConflictsDialog(branch: string, files: string[]) {
        const dialog = document.createElement("div");
        dialog.classList.add("dialog");

        const container = document.createElement("div");
        container.classList.add("conflicts");

        container.innerHTML = `<h2>Conflicts</h2>
        <p>Unable to pull <b>${branch}</b> branch because these files have been modified and would be overwritten.</p>
        <ul>
            ${files.map((file) => `<li>${file}</li>`).join("")}
        </ul>
        <p class="cross-section"><span>You have two options</span></p>`;

        const newBranchText = document.createElement("p");
        newBranchText.innerText = "Create a new branch with your changes.";
        container.append(newBranchText);

        const newBranchForm = document.createElement("form");

        const newBranchLabel = document.createElement("label");
        newBranchLabel.innerText = "Branch Name";
        newBranchForm.append(newBranchLabel);

        const newBranchInput = document.createElement("input");
        newBranchForm.append(newBranchInput);

        const newBranchButton = document.createElement("button");
        newBranchButton.innerText = "Branch";
        newBranchForm.append(newBranchButton);

        newBranchForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const branchName = newBranchInput.value;
            if (!branchName) return;

            newBranchButton.innerText = "Branching...";
            newBranchButton.disabled = true;
            revertAndPullButton.disabled = true;
            setTimeout(async () => {
                await api.git.branch.create(this.project, branchName);
                dialog.remove();
                this.btn.replaceWith(await this.renderButton(true));
            }, 200);
        });

        container.append(newBranchForm);

        const or = document.createElement("p");
        or.classList.add("cross-section");
        or.innerHTML = "<span>or</span>";
        container.append(or);

        const revertAndPullText = document.createElement("p");
        revertAndPullText.innerText = "Revert all current modifications.";
        container.append(revertAndPullText);

        const revertAndPullButton = document.createElement("button");
        revertAndPullButton.classList.add("danger");
        revertAndPullButton.innerText = "Revert";
        revertAndPullButton.addEventListener("click", () => {
            revertAndPullButton.innerText = "Reverting...";
            revertAndPullButton.disabled = true;
            newBranchButton.disabled = true;
            setTimeout(async () => {
                await api.git.revertFileChanges(this.project, files);
                dialog.remove();
                this.btn.replaceWith(await this.renderButton(true));
            }, 200);
        });

        container.append(revertAndPullButton);

        dialog.append(container);

        this.parentContainer.append(dialog);
    }

    async renderButton(pull = false) {
        if (!this.project.gitRepository) {
            return document.createElement("div");
        }

        this.btn = document.createElement("button");
        this.btn.classList.add("text", "text-and-icon", "git-btn");

        const [gitIcon, arrowIcon] = await Promise.all([
            (await fetch("assets/icons/git.svg")).text(),
            (await fetch("assets/icons/arrow.svg")).text()
        ]);
        this.btn.innerHTML = gitIcon;

        const { branch, commit } = await this.getCurrentBranchAndCommit();

        this.btn.addEventListener("click", () =>
            this.renderDialog(gitIcon, branch, commit)
        );

        const branchContainer = document.createElement("div");
        branchContainer.classList.add("branch");
        branchContainer.innerText = branch;
        this.btn.append(branchContainer);

        const commitContainer = document.createElement("div");
        commitContainer.classList.add("commit");
        commitContainer.innerText = commit.slice(0, 7);
        this.btn.append(commitContainer);

        if (pull) {
            const pullIcon = document.createElement("div");
            pullIcon.classList.add("pull");
            pullIcon.innerHTML = arrowIcon;
            this.btn.prepend(pullIcon);

            setTimeout(async () => {
                const maybeError = await api.git.pull(this.project);
                pullIcon.remove();
                if (maybeError && maybeError?.error) {
                    if (maybeError.error === "Conflicts") {
                        this.renderConflictsDialog(branch, maybeError.files);
                        return;
                    } else if (maybeError.error === "Merge") {
                        this.merging = {
                            theirs: maybeError.theirs,
                            filepaths: maybeError.files
                        };
                        this.openFiles(maybeError.files);
                        return;
                    }

                    const alertIcon = document.createElement("div");
                    alertIcon.classList.add("alert");
                    alertIcon.innerHTML = await (
                        await fetch("assets/icons/alert.svg")
                    ).text();
                    this.btn.prepend(alertIcon);
                } else {
                    this.btn.replaceWith(await this.renderButton());
                    this.reloadContent();
                }
            }, 500);
        }

        return this.btn;
    }
}
