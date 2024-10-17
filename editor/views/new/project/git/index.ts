import api from "../../../../api";
import { Project } from "../../../../api/config/types";
import { getParsedChanges } from "../../../../api/git";
import { Dialog } from "../../../../components/dialog";
import { Popover } from "../../../../components/popover";
import { Button, ButtonGroup } from "../../../../components/primitives/button";
import { Icon } from "../../../../components/primitives/icon";
import { InputText } from "../../../../components/primitives/inputs";
import { CodeEditor } from "../code-editor";

type GitOpts = {
    project: Project;
    didUpdateProject: () => void;
    didUpdateFiles: () => void;
};

export function Git(opts: GitOpts) {
    const container = document.createElement("div");
    container.classList.add("git-dialog");

    const top = document.createElement("div");
    top.classList.add("git-top");

    const branchButton = Button({
        style: "icon-large",
        iconLeft: "Git Branch"
    });

    top.append(Icon("Git"), RepoInfos(opts.project), branchButton);

    const buttonRow = document.createElement("div");
    buttonRow.classList.add("git-buttons");

    const closeButton = Button({
        text: "Close",
        style: "text"
    });
    closeButton.onclick = () => {
        remove();
    };

    const commitAndPushButtons = document.createElement("div");

    const commitButton = Button({
        text: "Commit",
        style: "text"
    });
    const pushButton = Button({
        text: "Push"
    });

    commitButton.disabled = true;
    pushButton.disabled = true;

    commitAndPushButtons.append(commitButton, pushButton);
    buttonRow.append(closeButton, commitAndPushButtons);

    const reloadStatus = () => {
        const updatedStatus = Status({
            project: opts.project,
            buttons: {
                commit: commitButton,
                push: pushButton
            },
            didRevertChange: async () => {
                await CodeEditor.reloadActiveFilesContent();
                reloadStatus();
                opts.didUpdateFiles();
            }
        });
        if (status) {
            status.replaceWith(updatedStatus);
        }

        status = updatedStatus;
    };

    let status: ReturnType<typeof Status>;
    reloadStatus();

    container.append(
        top,
        Author({
            project: opts.project,
            didUpdateAuthor: opts.didUpdateProject
        }),
        status,
        buttonRow);

    const { remove } = Dialog(container);

    return remove;
}

function RepoInfos(project: Project) {
    const container = document.createElement("div");
    container.classList.add("git-info");

    const webLink = document.createElement("a");
    webLink.target = "_blank";
    webLink.href = project.gitRepository.url;
    webLink.innerText = project.gitRepository.url;

    container.append(webLink);

    Promise.all([api.git.currentBranch(project), api.git.log(project, 1)]).then(
        ([branch, commit]) => {
            container.innerHTML += `
            <div>${branch}</div>
            <div>${commit.at(0).oid}</div>
        `;
        }
    );

    return container;
}

type AuthorOpts = {
    project: Project,
    didUpdateAuthor: () => void
}

function Author(opts: AuthorOpts) {
    const container = document.createElement("div");
    container.classList.add("git-author");

    const editButton = Button({
        style: "icon-small",
        iconLeft: "Edit"
    });

    const infos = document.createElement("div");
    infos.innerHTML = `
        <div>${opts.project.gitRepository.name || "No Name"}</div>
        <div>${opts.project.gitRepository.email || "No Email"}</div>
    `;

    editButton.onclick = () => {
        container.classList.add("with-form");

        const form = document.createElement("form");
        form.classList.add("git-author-form");

        const nameInput = InputText({
            label: "Name"
        })
        nameInput.input.value = opts.project.gitRepository.name || "";
        form.append(nameInput.container);

        const emailInput = InputText({
            label: "Email"
        })
        emailInput.input.type = "email";
        emailInput.input.value = opts.project.gitRepository.email || "";
        form.append(emailInput.container);

        const buttons = document.createElement("div");

        const cancelButton = Button({
            text: "Cancel",
            style: "text"
        })
        const closeForm = () => {
            form.replaceWith(infos);
            container.classList.remove("with-form");
        }
        cancelButton.type = "button";
        cancelButton.onclick = closeForm

        const saveButton = Button({
            text: "Save"
        })
        saveButton.type = "submit";

        let didUpdate = false;
        const updateAuthor = async () => {
            if (didUpdate) return;
            didUpdate = true;

            await api.projects.update({
                ...opts.project,
                gitRepository: {
                    ...opts.project.gitRepository,
                    name: nameInput.input.value,
                    email: emailInput.input.value
                }
            });
            opts.didUpdateAuthor();
        }

        saveButton.onclick = updateAuthor

        buttons.append(cancelButton, saveButton);

        form.append(buttons);

        form.onsubmit = e => {
            e.preventDefault();
            e.stopPropagation();

            updateAuthor();
        }

        infos.replaceWith(form);
    }

    container.append(Icon("User"), infos, editButton);

    return container;
}

type StatusOpts = {
    project: Project;
    buttons: {
        commit: HTMLButtonElement,
        push: HTMLButtonElement
    }
    didRevertChange: () => void;
};

function Status(opts: StatusOpts) {
    const container = document.createElement("div");
    container.classList.add("git-status");

    container.innerText = "Calculating diffs...";

    opts.buttons.commit.disabled = true;
    opts.buttons.push.disabled = true;

    CodeEditor.saveAllActiveFiles()
        .then(() => {
            api.git.changes(opts.project)
                .then((changes) => {
                    if (
                        changes.added.length === 0 &&
                        changes.modified.length === 0 &&
                        changes.deleted.length === 0
                    ) {
                        container.innerText = "Nothing to commit";
                    } else {
                        container.innerText = "";
                        container.append(
                            ChangesList({
                                changes,
                                project: opts.project,
                                didRevertChange: opts.didRevertChange
                            })
                        );

                        if (opts.project.gitRepository.name) {
                            const form = document.createElement("form");

                            const commitMessageInput = InputText({
                                label: "Commit Message"
                            });
                            form.append(commitMessageInput.container)
                            container.append(form);

                            commitMessageInput.input.onkeyup = () => {
                                if (commitMessageInput.input.value) {
                                    opts.buttons.commit.disabled = false;
                                    opts.buttons.push.disabled = false;
                                } else {
                                    opts.buttons.commit.disabled = true;
                                    opts.buttons.push.disabled = true;
                                }
                            }

                            form.onsubmit = (e) => {
                                e.preventDefault();


                            }

                            setTimeout(() => commitMessageInput.input.focus(), 1);
                        }
                    }
                });
        });


    return container;
}

type ChangesListOpts = {
    project: Project;
    changes: Awaited<ReturnType<typeof getParsedChanges>>;
    didRevertChange: () => void;
};

function ChangesList(opts: ChangesListOpts) {
    const container = document.createElement("div");
    container.classList.add("git-changes");

    const addSection = (subtitle: string, filesList: string[]) => {
        if (filesList.length === 0) return;

        const subtitleEl = document.createElement("div");
        subtitleEl.innerText = subtitle;

        container.append(
            subtitleEl,
            FilesList({
                files: filesList,
                project: opts.project,
                didRevertChange: opts.didRevertChange
            })
        );
    };

    addSection("Added", opts.changes.added);
    addSection("Modified", opts.changes.modified);
    addSection("Deleted", opts.changes.deleted);

    return container;
}

type FilesListOpts = {
    files: string[];
    project: Project;
    didRevertChange: () => void;
};

function FilesList(opts: FilesListOpts) {
    const list = document.createElement("ul");

    const items = opts.files.map((file) => {
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
                api.git
                    .revertFileChanges(opts.project, [file])
                    .then(opts.didRevertChange);
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
