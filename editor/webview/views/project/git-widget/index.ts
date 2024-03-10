import "./index.css";

import type { Project as TypeProject } from "../../../../api/projects/types";

import type typeRPC from "../../../../../src/webview";
import type api from "../../../../api";

declare var rpc: typeof typeRPC<typeof api>;

export default class GitWidget {
    reloadContent: () => void;
    parentContainer: HTMLDivElement;
    project: TypeProject;

    btn: HTMLButtonElement;

    constructor(reloadContent: GitWidget["reloadContent"]){
        this.reloadContent = reloadContent;
    }

    private async getCurrentBranchAndCommit() {
        const [branch, commit] = await Promise.all([
            rpc().git.currentBranch(this.project),
            rpc().git.log(this.project, 1)
        ]);

        return {
            branch: branch || "DETACHED",
            commit: commit?.at(0)?.oid || ""
        }
    }

    private async renderBranches(backAction: () => void){
        const container = document.createElement("div");
        container.classList.add("branches")

        const top = document.createElement("div");

        const leftSide = document.createElement("div")

        const backButton = document.createElement("button");
        backButton.classList.add("text");
        backButton.addEventListener("click", backAction);
        backButton.innerHTML = await (await fetch("assets/icons/chevron.svg")).text();
        leftSide.append(backButton);

        const title = document.createElement("h3");
        title.innerText = "Branches";
        leftSide.append(title);
        top.append(leftSide);

        const createBranchButton = document.createElement("button");
        createBranchButton.innerText = "Create";
        top.append(createBranchButton);

        container.append(top);

        const [
            arrow,
            check,
            close,
            deleteIcon
        ] = await Promise.all([
            (await fetch("assets/icons/arrow.svg")).text(),
            (await fetch("assets/icons/check.svg")).text(),
            (await fetch("assets/icons/close.svg")).text(),
            (await fetch("assets/icons/delete.svg")).text()
        ])

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
            })

            form.addEventListener("submit", async e => {
                e.preventDefault();
                form.innerHTML = `Creating <b>${branchNameInput.value}</b> branch...`;
                await rpc().git.branch.create(this.project, branchNameInput.value);
                form.remove();
                createBranchButton.disabled = false;
                container.querySelector("ul").replaceWith(await renderBranchList());
                this.btn.replaceWith(await this.renderButton());
            })

            form.append(buttonGroup);

            return form;
        }

        const formContainer = document.createElement("div");
        container.append(formContainer);

        createBranchButton.addEventListener("click", () => {
            formContainer.append(renderBranchForm());
        })


        const renderBranchList = async () => {
            const [
                currentBranch,
                branches
            ] = await Promise.all([
                rpc().git.currentBranch(this.project),
                rpc().git.branch.getAll(this.project),
            ]);

            const ul = document.createElement("ul");
            new Set(Object.values(branches).flat()).forEach(branch => {
                if(branch === "HEAD") return;

                const li = document.createElement("li");

                const branchIsLocalOnly = branches.local.includes(branch) && !branches.remote.includes(branch);

                if (branch === currentBranch) {
                    const arrowContainer = document.createElement("span");
                    arrowContainer.innerHTML = arrow;
                    li.append(arrowContainer);
                }  else if(branchIsLocalOnly) {
                    const deleteButton = document.createElement("button");
                    deleteButton.classList.add("text", "danger", "small");
                    deleteButton.innerHTML = deleteIcon;
                    deleteButton.addEventListener("click", async () => {
                        await rpc().git.branch.delete(this.project, branch);
                        ul.replaceWith(await renderBranchList());
                    })
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
                }

                if(branch !== currentBranch){
                    const checkoutButton = document.createElement("button");
                    checkoutButton.classList.add("text");
                    checkoutButton.innerText = "Checkout";
                    checkoutButton.addEventListener("click", async () => {
                        await rpc().git.checkout(this.project, branch);
                        ul.replaceWith(await renderBranchList());
                        this.btn.replaceWith(await this.renderButton(!branchIsLocalOnly));
                        this.reloadContent();
                    })
                    li.append(checkoutButton);
                }

                ul.append(li);
            })

            return ul;
        }

        
        setTimeout(async () => container.append(await renderBranchList()), 200);

        return container;
    }

    private async renderDialog(
        icon: string,
        branch: string,
        commit: string,
        elements?: {dialog: HTMLDivElement, container: HTMLDivElement}
    ) {
        const dialog = elements?.dialog || document.createElement("div");
        dialog.classList.add("dialog");

        const [userIcon, editIcon, closeIcon, checkIcon, branchIcon] = await Promise.all([
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
                const { branch, commit } = await this.getCurrentBranchAndCommit();
                container.innerHTML = "";
                this.renderDialog(icon, branch, commit, {container, dialog});
            }
            container.append(await this.renderBranches(rerenderDialog))
        })
        gitInfo.append(branchButton)

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
            buttonGroup.classList.add("button-group")

            const confirmButton = document.createElement("button");
            confirmButton.classList.add("text");
            confirmButton.addEventListener("click", async () => {
                this.project.gitRepository.name = nameInput.value;
                this.project.gitRepository.email = emailInput.value;
                renderAuthorInfo();
                await rpc().projects.update(this.project);
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
                    dialog.remove();

                    const arrowIcon = await (
                        await fetch("assets/icons/arrow.svg")
                    ).text();

                    let pushIcon = document.createElement("div");
                    pushIcon.classList.add("push");
                    pushIcon.innerHTML = arrowIcon;
                    this.btn.prepend(pushIcon);

                    setTimeout(async () => {
                        await rpc().git.push(
                            this.project,
                            commitMessageInput.value
                        );
                        this.btn.replaceWith(await this.renderButton());
                    }, 500);
                });
            }
        };

        const buttonGroup = document.createElement("div");
        buttonGroup.classList.add("button-group")

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

        if(!elements)
            this.parentContainer.append(dialog);

        setTimeout(getChanges, 500);
    }

    async renderButton(pull = false){
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
                const maybeError = await rpc().git.pull(this.project);
                pullIcon.remove();
                if (maybeError && maybeError?.error) {
                    const alertIcon = document.createElement("div");
                    alertIcon.classList.add("alert");
                    alertIcon.innerHTML = await (
                        await fetch("assets/icons/alert.svg")
                    ).text();
                    this.btn.prepend(alertIcon);
                } else {
                    this.btn.replaceWith(await this.renderButton());
                }
            }, 500);
        }

        return this.btn;
    }
}