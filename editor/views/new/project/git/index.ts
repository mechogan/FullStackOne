import api from "../../../../api";
import { Project } from "../../../../api/config/types";
import { getParsedChanges } from "../../../../api/git";
import { Dialog } from "../../../../components/dialog";
import { Message } from "../../../../components/message";
import { Popover } from "../../../../components/popover";
import { Button, ButtonGroup } from "../../../../components/primitives/button";
import { Icon } from "../../../../components/primitives/icon";
import { InputText } from "../../../../components/primitives/inputs";
import { WorkerTS } from "../../../../typescript";
import { CodeEditor } from "../code-editor";
import { Branches } from "./branches";

type GitOpts = {
    project: Project;
    didUpdateProject: () => void;
    didUpdateFiles: () => void;
    didChangeCommitOrBranch: () => void;
    didPushEvent: (event: "start" | "end") => void;
};

export function Git(opts: GitOpts) {
    let objRemove: { remove: () => void } = { remove: null };
    const view = GitView(opts, objRemove);
    objRemove.remove = Dialog(view).remove;
    return objRemove.remove;
}

function GitView(opts: GitOpts, objRemove: { remove: () => void }) {
    const container = document.createElement("div");
    container.classList.add("git-dialog");

    const top = document.createElement("div");
    top.classList.add("git-top");

    const branchButton = Button({
        style: "icon-large",
        iconLeft: "Git Branch"
    });
    branchButton.onclick = () => {
        const branches = Branches({
            project: opts.project,
            didChangeBranch: () => {
                WorkerTS.call().invalidateWorkingDirectory();
                CodeEditor.reloadActiveFilesContent();
                opts.didUpdateFiles();
                opts.didChangeCommitOrBranch();
            },
            goBack: () => branches.replaceWith(GitView(opts, objRemove)),
            removeDialog: () => objRemove.remove()
        });
        container.replaceWith(branches);
    };

    top.append(Icon("Git"), RepoInfos(opts.project), branchButton);

    const buttonRow = document.createElement("div");
    buttonRow.classList.add("git-buttons");

    const closeButton = Button({
        text: "Close",
        style: "text"
    });
    closeButton.onclick = () => {
        objRemove.remove();
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
            didCommit: () => {
                container.replaceWith(GitView(opts, objRemove));
                opts.didChangeCommitOrBranch();
            },
            didRevertChange: async () => {
                await CodeEditor.reloadActiveFilesContent();
                reloadStatus();
                opts.didUpdateFiles();
            },
            didPushEvent: (event) => {
                if(event === "start") {
                    objRemove.remove();
                } 
                opts.didPushEvent(event);
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
        buttonRow
    );

    return container;
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
    project: Project;
    didUpdateAuthor: () => void;
};

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
        });
        nameInput.input.value = opts.project.gitRepository.name || "";
        form.append(nameInput.container);

        const emailInput = InputText({
            label: "Email"
        });
        emailInput.input.type = "email";
        emailInput.input.value = opts.project.gitRepository.email || "";
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

type StatusOpts = {
    project: Project;
    buttons: {
        commit: HTMLButtonElement;
        push: HTMLButtonElement;
    };
    didRevertChange: () => void;
    didCommit: () => void;
    didPushEvent: GitOpts["didPushEvent"]
};

function Status(opts: StatusOpts) {
    const container = document.createElement("div");
    container.classList.add("git-status");

    container.innerText = "Calculating diffs...";

    opts.buttons.commit.disabled = true;
    opts.buttons.push.disabled = true;

    CodeEditor.saveAllActiveFiles().then(() => {
        Promise.all([
            api.git.changes(opts.project),
            api.git.testRemote(opts.project)
        ]).then(async ([changes, reacheable]) => {

            let toPush: Awaited<ReturnType<typeof findCommitCountToPush>> = null;
            if (reacheable) {
                toPush = await findCommitCountToPush(opts.project)
            }

            const hasChanges = changes.added.length ||
                changes.modified.length ||
                changes.deleted.length;
            const hasGitUserName = opts.project.gitRepository.name;

            container.innerText = "";

            if (hasChanges) {
                container.append(
                    ChangesList({
                        changes,
                        project: opts.project,
                        didRevertChange: opts.didRevertChange
                    })
                );
            } else {
                container.innerText = "Nothing to commit";
            }

            let commitMessageInput: ReturnType<typeof InputText>;
            if (hasChanges && hasGitUserName) {
                const form = document.createElement("form");

                commitMessageInput = InputText({
                    label: "Commit Message"
                });
                form.append(commitMessageInput.container);
                container.append(form);

                commitMessageInput.input.onkeyup = () => {
                    if (commitMessageInput.input.value) {
                        opts.buttons.commit.disabled = false;
                        opts.buttons.push.disabled = !reacheable;
                    } else {
                        opts.buttons.commit.disabled = true;
                        opts.buttons.push.disabled = !(toPush?.commitCount || toPush?.pushBranch);
                    }
                };

                form.onsubmit = (e) => {
                    e.preventDefault();
                };

                setTimeout(() => commitMessageInput.input.focus(), 1);
            }


            let message: ReturnType<typeof Message>;
            if (!hasGitUserName) {
                message = Message({
                    text: "No git user.name",
                    style: "warning"
                })
            } else if (!reacheable) {
                message = Message({
                    text: "Remote is unreachable",
                    style: "warning"
                })
            } else if (toPush?.pushBranch) {
                message = Message({
                    text: "Push new branch to remote"
                });
                opts.buttons.push.disabled = false;
            } else if (toPush?.commitCount) {
                const count = toPush.commitCount > 10
                    ? "10+"
                    : toPush.commitCount.toString()
                message = Message({
                    text: `Push ${count} commit${toPush.commitCount > 1 ? "s" : ""} to remote`
                })
                opts.buttons.push.disabled = false;
            }

            const commit = async () => {
                if(!commitMessageInput?.input.value)
                    return;

                return api.git.commit(opts.project, commitMessageInput.input.value)
            };

            opts.buttons.commit.onclick = async () => {
                await commit();
                opts.didCommit()
            }

            opts.buttons.push.onclick = async () => {
                await commit();
                opts.didCommit();
                opts.didPushEvent("start");
                api.git.push(opts.project)
                    .then(() => opts.didPushEvent("end"))
            }

            if (message) {
                container.append(message);
            }
        });
    });

    return container;
}

async function findCommitCountToPush(project: Project): Promise<{
    pushBranch: boolean,
    commitCount: number,
}> {
    const [
        currentBranch,
        logs,
        remoteRefs
    ] = await Promise.all([
        api.git.currentBranch(project),
        api.git.log(project, 10),
        api.git.listServerRefs(project)
    ]);

    let pushBranch = true;
    let commitCount = 0;

    for (let i = 0; i < remoteRefs.length; i++) {
        const remoteBranch = remoteRefs[i].ref.split("/").pop();

        if (remoteBranch === currentBranch) {
            pushBranch = false;

            let found = false;
            for (const commit of logs) {
                if (commit.oid === remoteRefs[i].oid) {
                    found = true;
                    break;
                }

                commitCount++;
            }

            if (!found)
                commitCount++;

            break;
        }
    }

    return { pushBranch, commitCount };
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
