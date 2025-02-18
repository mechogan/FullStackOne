import { Button, Icon, Message, InputText, ButtonGroup, Popover, Dialog } from "@fullstacked/ui";
import { refreshGitWidgetBranchAndCommit } from "..";
import { createElement } from "../../../components/element";
import { createRefresheable } from "../../../components/refresheable";
import git from "../../../lib/git";
import { Store } from "../../../store";
import { Project } from "../../../types";
import { saveAllViews } from "../code-editor";
import { Branches } from "./branches";

let branchView = false;
let refreshMainView: () => void;
export const toggleCommitAndBranchView = () => {
    branchView = !branchView;
    refreshMainView();
};

export function Git(project: Project) {
    branchView = false;

    const container = createElement("div");
    container.classList.add("git-dialog");

    const { remove } = Dialog(container);

    const createCloseButton = () => {
        const closeButton = Button({
            text: "Close",
            style: "text"
        });
        closeButton.onclick = () => remove();
        return closeButton;
    };

    const renderCommitOrBranchView = () => {
        if (branchView) {
            return Branches(project, createCloseButton());
        } else {
            return CommitView(project, createCloseButton);
        }
    };

    const viewsRefresheable = createRefresheable(renderCommitOrBranchView);
    refreshMainView = viewsRefresheable.refresh;
    refreshMainView();

    container.append(viewsRefresheable.element);

    container.ondestroy = () => {
        viewsRefresheable.element.destroy();
    };
}

let refresh: {
    repoInfo: () => void;
    author: () => void;
    status: () => void;
    commitAndPush: () => void;
};

function CommitView(
    project: Project,
    createCloseButton: () => HTMLButtonElement
) {
    const container = createElement("div");

    const repoInfosRefresheable = createRefresheable(RepoInfos);
    const authorRefresheable = createRefresheable(Author);

    const statusPlaceholder = createElement("div");
    statusPlaceholder.classList.add("status-placeholder");
    statusPlaceholder.innerText = "Calculating diffs...";
    const statusRefresheable = createRefresheable(Status, statusPlaceholder);

    const commitAndPushRefresheable = createRefresheable(CommitAndPushButtons);

    refresh = {
        repoInfo: () => repoInfosRefresheable.refresh(project),
        author: () => authorRefresheable.refresh(project),
        status: () => statusRefresheable.refresh(project),
        commitAndPush: () =>
            commitAndPushRefresheable.refresh(project, createCloseButton())
    };

    const refreshOnProjectUpdate = (projects: Project[]) => {
        project = projects.find(({ id }) => project.id === id);
        refresh.author();
        refresh.commitAndPush();
    };

    Store.projects.list.subscribe(refreshOnProjectUpdate);
    container.ondestroy = () => {
        Store.projects.list.unsubscribe(refreshOnProjectUpdate);
    };

    const top = document.createElement("div");
    top.classList.add("git-top");

    const branchButton = Button({
        style: "icon-large",
        iconLeft: "Git Branch"
    });
    branchButton.onclick = toggleCommitAndBranchView;

    top.append(Icon("Git"), repoInfosRefresheable.element, branchButton);

    container.append(
        top,
        authorRefresheable.element,
        statusRefresheable.element,
        commitAndPushRefresheable.element
    );

    refresh.repoInfo();
    refresh.author();
    saveAllViews().then(() => {
        refresh.status();
        refresh.commitAndPush();
    });

    return container;
}

let changesPromise: Promise<{
    changes: {
        Added: string[];
        Modified: string[];
        Deleted: string[];
    };
    hasChanges: boolean;
}>;

export function projectChanges(project: Project) {
    if (!changesPromise) {
        changesPromise = _projectChanges(project);
    }
    return changesPromise;
}

async function _projectChanges(project: Project) {
    const changes = await git.status(project.id);
    const hasChanges =
        changes.Added.length !== 0 ||
        changes.Modified.length !== 0 ||
        changes.Deleted.length !== 0;

    changesPromise = null;
    return { changes, hasChanges };
}

async function CommitAndPushButtons(
    project: Project,
    closeButton: HTMLButtonElement
) {
    const container = createElement("div");
    container.classList.add("git-form");

    const buttonsRow = document.createElement("div");
    buttonsRow.classList.add("git-buttons");

    const commitAndPushButtons = document.createElement("div");

    const commitButton = Button({
        text: "Commit",
        style: "text"
    });
    commitButton.type = "button";
    commitButton.disabled = true;

    const pushButton = Button({
        text: "Push"
    });
    pushButton.type = "button";
    pushButton.disabled = true;

    commitAndPushButtons.append(commitButton, pushButton);

    buttonsRow.append(closeButton, commitAndPushButtons);
    container.append(buttonsRow);

    const hasAuthor = project.gitRepository?.name;
    if (!hasAuthor) {
        container.prepend(
            Message({
                style: "warning",
                text: "No git user.name"
            })
        );
        return container;
    }

    const { hasChanges } = await projectChanges(project);

    if (!hasChanges) {
        return container;
    }

    let reacheable = false;
    git.fetch(project)
        .then(() => {
            reacheable = true;
            toggleButtonsDisabled();
        })
        .catch(() => {
            const message = Message({
                style: "warning",
                text: "Remote is unreachable"
            });
            form.append(message);
        });

    const form = document.createElement("form");

    const commitMessageInput = InputText({
        label: "Commit Message"
    });

    form.append(commitMessageInput.container);

    container.prepend(form);

    const toggleButtonsDisabled = () => {
        if (commitMessageInput.input.value) {
            commitButton.disabled = false;
            pushButton.disabled = !reacheable;
        } else {
            commitButton.disabled = true;
            pushButton.disabled = true;
        }
    };

    commitMessageInput.input.onkeyup = toggleButtonsDisabled;

    setTimeout(() => commitMessageInput.input.focus(), 1);

    const commit = async () => {
        commitButton.disabled = true;
        const commitMessage = commitMessageInput.input.value;
        form.reset();
        await git.commit(project, commitMessage);
        commitButton.disabled = false;
        refresh.repoInfo();
        refresh.status();
        refresh.commitAndPush();
        refreshGitWidgetBranchAndCommit();
    };

    const push = async () => {
        pushButton.disabled = true;
        await commit();
        if (reacheable) {
            git.push(project);
            closeButton.click();
        }
        pushButton.disabled = false;
    };

    commitButton.onclick = commit;
    pushButton.onclick = push;
    form.onsubmit = (e) => {
        e.preventDefault();
        push();
    };

    return container;
}

function RepoInfos(project: Project) {
    const container = createElement("div");
    container.classList.add("git-info");

    const webLink = document.createElement("a");
    webLink.target = "_blank";
    webLink.href = project.gitRepository.url;
    webLink.innerText = project.gitRepository.url;

    container.append(webLink);

    git.head(project.id).then(({ Name, Hash }) => {
        container.innerHTML += `
                <div>${Name}</div>
                <div>${Hash}</div>
            `;
    });

    return container;
}

function Author(project: Project) {
    const container = createElement("div");
    container.classList.add("git-author");

    let formView = false;
    const render = () => {
        if (formView) {
            return AuthorForm(project, () => {
                formView = false;
                refresheable.refresh();
            });
        } else {
            return AuthorInfos(project, () => {
                formView = true;
                refresheable.refresh();
            });
        }
    };

    const refresheable = createRefresheable(render);
    refresheable.refresh();
    container.append(Icon("User"), refresheable.element);

    return container;
}

function AuthorForm(project: Project, toggleView: () => void) {
    const form = createElement("form");
    form.classList.add("git-author-form");

    const nameInput = InputText({
        label: "Name"
    });
    nameInput.input.value = project.gitRepository.name || "";
    form.append(nameInput.container);

    const emailInput = InputText({
        label: "Email"
    });
    emailInput.input.type = "email";
    emailInput.input.value = project.gitRepository.email || "";
    form.append(emailInput.container);

    const buttons = document.createElement("div");

    const cancelButton = Button({
        text: "Cancel",
        style: "text"
    });
    cancelButton.onclick = toggleView;
    cancelButton.type = "button";

    const saveButton = Button({
        text: "Save"
    });
    saveButton.type = "submit";

    const updateAuthor = async () => {
        saveButton.disabled = true;

        const updatedProject: Project = {
            ...project,
            gitRepository: {
                ...project.gitRepository,
                email: emailInput.input.value,
                name: nameInput.input.value
            }
        };

        Store.projects.update(project, updatedProject);
    };

    saveButton.onclick = updateAuthor;

    buttons.append(cancelButton, saveButton);

    form.append(buttons);

    form.onsubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();

        updateAuthor();
    };

    return form;
}

function AuthorInfos(project: Project, toggleView: () => void) {
    const container = createElement("div");
    container.classList.add("git-author-infos");

    const editButton = Button({
        style: "icon-small",
        iconLeft: "Edit"
    });
    editButton.onclick = toggleView;

    const infos = document.createElement("div");
    infos.innerHTML = `
        <div>${project.gitRepository.name || "No Name"}</div>
        <div>${project.gitRepository.email || "No Email"}</div>
    `;

    container.append(infos, editButton);

    return container;
}

async function Status(project: Project) {
    const container = createElement("div");
    container.classList.add("git-status");

    const { changes, hasChanges } = await projectChanges(project);

    if (hasChanges) {
        container.append(ChangesList(changes, project));
    } else {
        container.innerText = "Nothing to commit";
    }

    return container;
}

type Changes = Awaited<ReturnType<typeof git.status>>;

function ChangesList(changes: Changes, project: Project) {
    const container = document.createElement("div");
    container.classList.add("git-changes");

    const revertFile = (file: string) => git.restore(project.id, [file]);

    const addSection = (subtitle: string, files: string[]) => {
        if (files.length === 0) return;

        const subtitleEl = document.createElement("div");
        subtitleEl.innerText = subtitle;

        container.append(subtitleEl, FilesList(files, revertFile));
    };

    addSection("Added", changes.Added);
    addSection("Modified", changes.Modified);
    addSection("Deleted", changes.Deleted);

    return container;
}

function FilesList(files: string[], revert: (file: string) => Promise<void>) {
    const list = document.createElement("ul");

    const items = files.map((file) => {
        const item = document.createElement("li");
        item.innerHTML = `<span>${file}</span>`;

        const optionsButton = Button({
            style: "icon-small",
            iconLeft: "Options"
        });

        optionsButton.onclick = () => {
            const revertButton = Button({
                text: "Revert",
                iconLeft: "Revert",
                color: "red"
            });

            revertButton.onclick = () => {
                revert(file).then(() => {
                    refresh.status();
                    refresh.commitAndPush();
                });
            };

            const buttonGroup = ButtonGroup([revertButton]);

            Popover({
                anchor: optionsButton,
                content: buttonGroup,
                align: {
                    x: "right",
                    y: "center"
                }
            });
        };

        item.append(optionsButton);

        return item;
    });

    list.append(...items);

    return list;
}
