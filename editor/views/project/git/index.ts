import { refreshGitWidgetBranchAndCommit } from "..";
import { Dialog } from "../../../components/dialog";
import { createElement } from "../../../components/element";
import { Message } from "../../../components/message";
import { Popover } from "../../../components/popover";
import { Button, ButtonGroup } from "../../../components/primitives/button";
import { Icon } from "../../../components/primitives/icon";
import { InputText } from "../../../components/primitives/inputs";
import { createRefresheable } from "../../../components/refresheable";
import { ipcEditor } from "../../../ipc";
import { Store } from "../../../store";
import { Project } from "../../../types";
import { refreshCodeEditorView, saveAllViews } from "../code-editor";
import { refreshFullFileTree } from "../file-tree";

let refresh: {
    repoInfo: () => void;
    author: () => void;
    status: () => void;
    commitAndPush: () => void;
};

export function Git(project: Project) {
    const container = createElement("div");
    container.classList.add("git-dialog");

    const repoInfosRefresheable = createRefresheable(RepoInfos);
    const authorRefresheable = createRefresheable(Author);

    const statusPlaceholder = createElement("div");
    statusPlaceholder.innerText = "Calculating diffs...";
    const statusRefresheable = createRefresheable(Status, statusPlaceholder);

    const commitAndPushRefresheable = createRefresheable(CommitAndPushButtons);

    const closeButton = Button({
        text: "Close",
        style: "text"
    });
    closeButton.onclick = () => closeDialog();

    refresh = {
        repoInfo: () => repoInfosRefresheable.refresh(project),
        author: () => authorRefresheable.refresh(project),
        status: () => statusRefresheable.refresh(project),
        commitAndPush: () =>
            commitAndPushRefresheable.refresh(project, closeButton)
    };

    const refreshOnProjectUpdate = (projects: Project[]) => {
        project = projects.find(({ id }) => project.id === id);
        refresh.author();
        refresh.commitAndPush();
    };

    Store.projects.list.subscribe(refreshOnProjectUpdate);
    const closeDialog = () => {
        Store.projects.list.unsubscribe(refreshOnProjectUpdate);
        remove();
    };

    const top = document.createElement("div");
    top.classList.add("git-top");

    const branchButton = Button({
        style: "icon-large",
        iconLeft: "Git Branch"
    });
    branchButton.onclick = () => {
        // const branches = Branches({
        //     project: opts.project,
        //     didChangeBranch: () => {
        //         WorkerTS.call().invalidateWorkingDirectory();
        //         CodeEditor.reloadActiveFilesContent();
        //         opts.didUpdateFiles();
        //         opts.didChangeCommitOrBranch();
        //     },
        //     goBack: () => branches.replaceWith(GitView(opts, objRemove)),
        //     removeDialog: () => objRemove.remove()
        // });
        // container.replaceWith(branches);
    };

    top.append(Icon("Git"), repoInfosRefresheable.element, branchButton);

    container.append(
        top,
        authorRefresheable.element,
        statusRefresheable.element,
        commitAndPushRefresheable.element
    );

    const { remove } = Dialog(container);

    refresh.repoInfo();
    refresh.author();
    refresh.status();
    refresh.commitAndPush();
}

let changesPromise: Promise<{
    changes: {
        Added: string[];
        Modified: string[];
        Deleted: string[];
    };
    hasChanges: boolean;
}>;

function projectChanges(project: Project) {
    if (!changesPromise) {
        changesPromise = _projectChanges(project);
    }
    return changesPromise;
}

async function _projectChanges(project: Project) {
    await saveAllViews();
    const changes = await ipcEditor.git.status(project.id);
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
        container.prepend(Message({
            style: "warning",
            text: "No git user.name"
        }));
        return container;
    }

    const { hasChanges } = await projectChanges(project);

    if (!hasChanges) {
        return container;
    }

    let reacheable = false;
    ipcEditor.git.fetch(project.id)
        .then(() => {
            reacheable = true;
            toggleButtonsDisabled()
        })
        .catch(() => {})

    const form = document.createElement("form");

    const commitMessageInput = InputText({
        label: "Commit Message"
    })

    form.append(commitMessageInput.container);

    container.prepend(form);

    form.onsubmit = async e => {
        e.preventDefault();
        await commit();
    }

    const toggleButtonsDisabled = () => {
        if(commitMessageInput.input.value) {
            commitButton.disabled = false
            pushButton.disabled = !reacheable
        } else {
            commitButton.disabled = true
            pushButton.disabled = true
        }
    }

    commitMessageInput.input.onkeyup = toggleButtonsDisabled;

    setTimeout(() => commitMessageInput.input.focus(), 1);

    const commit = async () => {
        commitButton.disabled = true;
        const commitMessage = commitMessageInput.input.value;
        form.reset();
        await ipcEditor.git.commit(project, commitMessage);
        commitButton.disabled = false;
        refresh.repoInfo();
        refresh.status();
        refresh.commitAndPush();
        refreshGitWidgetBranchAndCommit();
    }

    commitButton.onclick = commit;
    
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

    ipcEditor.git.head(project.id).then(({ Name, Hash }) => {
        container.innerHTML += `
                <div>${Name.split("/").at(-1)}</div>
                <div>${Hash}</div>
            `;
    });

    return container;
}

function Author(project: Project) {
    const container = createElement("div");
    container.classList.add("git-author");

    const editButton = Button({
        style: "icon-small",
        iconLeft: "Edit"
    });

    const infos = document.createElement("div");
    infos.innerHTML = `
        <div>${project.gitRepository.name || "No Name"}</div>
        <div>${project.gitRepository.email || "No Email"}</div>
    `;

    editButton.onclick = () => {
        container.classList.add("with-form");

        const form = document.createElement("form");
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
        const closeForm = () => {
            form.replaceWith(infos);
            container.classList.remove("with-form");
        };
        cancelButton.type = "button";
        cancelButton.onclick = closeForm;

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

        infos.replaceWith(form);
    };

    container.append(Icon("User"), infos, editButton);

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

type Changes = Awaited<ReturnType<typeof ipcEditor.git.status>>;

function ChangesList(changes: Changes, project: Project) {
    const container = document.createElement("div");
    container.classList.add("git-changes");

    const addSection = (
        subtitle: string,
        files: string[],
        revertFile: Parameters<typeof FilesList>[1]
    ) => {
        if (files.length === 0) return;

        const subtitleEl = document.createElement("div");
        subtitleEl.innerText = subtitle;

        container.append(subtitleEl, FilesList(files, revertFile));
    };

    addSection("Added", changes.Added, async (file: string) => {
        await ipcEditor.git.restore(project.id, [file]);
        refreshFullFileTree();
        Store.editor.codeEditor.closeFile(project.id + "/" + file);
    });
    addSection("Modified", changes.Modified, async (file: string) => {
        await ipcEditor.git.restore(project.id, [file]);
        refreshCodeEditorView(project.id + "/" + file);
    });
    addSection("Deleted", changes.Deleted, async (file: string) => {
        await ipcEditor.git.restore(project.id, [file]);
        refreshFullFileTree();
    });

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
