import { Dialog } from "../../../components/dialog";
import { Popover } from "../../../components/popover";
import { Button, ButtonGroup } from "../../../components/primitives/button";
import { Icon } from "../../../components/primitives/icon";
import { InputText } from "../../../components/primitives/inputs";
import { ipcEditor } from "../../../ipc";
import { Project } from "../../../types";
import { saveAllViews } from "../code-editor";

export function Git(project: Project) {
    const container = document.createElement("div");
    container.classList.add("git-dialog");

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

    top.append(Icon("Git"), RepoInfos(project), branchButton);

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
    commitButton.type = "button";
    const pushButton = Button({
        text: "Push"
    });
    pushButton.type = "button";

    commitButton.disabled = true;
    pushButton.disabled = true;

    commitAndPushButtons.append(commitButton, pushButton);
    buttonRow.append(closeButton, commitAndPushButtons);

    container.append(top, Author(project), Status(project), buttonRow);

    const { remove } = Dialog(container);
}

function RepoInfos(project: Project) {
    const container = document.createElement("div");
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
    const container = document.createElement("div");
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

        const updateAuthor = async () => {};

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

function Status(project: Project) {
    const container = document.createElement("div");
    container.classList.add("git-status");

    container.innerText = "Calculating diffs...";

    // opts.buttons.commit.disabled = true;
    // opts.buttons.push.disabled = true;

    saveAllViews().then(async () => {
        const changes = await ipcEditor.git.status(project.id);
        const hasChanges =
            changes.Added.length ||
            changes.Modified.length ||
            changes.Deleted.length;

        container.innerText = "";

        if (hasChanges) {
            container.append(ChangesList(changes, project));
        } else {
            container.innerText = "Nothing to commit";
        }

        // Promise.all([
        //     api.git.changes(opts.project),
        //     api.git.testRemote(opts.project)
        // ]).then(async ([changes, reacheable]) => {
        //     let toPush: Awaited<ReturnType<typeof findCommitCountToPush>> =
        //         null;
        //     if (reacheable) {
        //         toPush = await findCommitCountToPush(opts.project);
        //     }

        // const hasGitUserName = opts.project.gitRepository.name;

        //     container.innerText = "";

        //     const commit = async () => {
        //         if (!commitMessageInput?.input.value) return;

        //         await api.git.commit(
        //             opts.project,
        //             commitMessageInput.input.value
        //         );
        //         opts.didCommit();
        //     };

        //     const push = () => {
        //         opts.didPushEvent("start");
        //         api.git.push(opts.project).then(() => opts.didPushEvent("end"));
        //     };

        //     let commitMessageInput: ReturnType<typeof InputText>;
        //     if (hasChanges && hasGitUserName) {
        //         const form = document.createElement("form");

        //         commitMessageInput = InputText({
        //             label: "Commit Message"
        //         });
        //         form.append(commitMessageInput.container);
        //         container.append(form);

        //         commitMessageInput.input.onkeyup = () => {
        //             if (commitMessageInput.input.value) {
        //                 opts.buttons.commit.disabled = false;
        //                 opts.buttons.push.disabled = !reacheable;
        //             } else {
        //                 opts.buttons.commit.disabled = true;
        //                 opts.buttons.push.disabled = !(
        //                     toPush?.commitCount || toPush?.pushBranch
        //                 );
        //             }
        //         };

        //         form.onsubmit = async (e) => {
        //             e.preventDefault();

        //             if (!commitMessageInput.input.value) return;

        //             await commit();
        //             if (reacheable) {
        //                 push();
        //             }
        //         };

        //         setTimeout(() => commitMessageInput.input.focus(), 1);
        //     }

        //     let message: ReturnType<typeof Message>;
        //     if (!hasGitUserName) {
        //         message = Message({
        //             text: "No git user.name",
        //             style: "warning"
        //         });
        //     } else if (!reacheable) {
        //         message = Message({
        //             text: "Remote is unreachable",
        //             style: "warning"
        //         });
        //     } else if (toPush?.pushBranch) {
        //         message = Message({
        //             text: "Push new branch to remote"
        //         });
        //         opts.buttons.push.disabled = false;
        //     } else if (toPush?.commitCount) {
        //         const count =
        //             toPush.commitCount > 10
        //                 ? "10+"
        //                 : toPush.commitCount.toString();
        //         message = Message({
        //             text: `Push ${count} commit${toPush.commitCount > 1 ? "s" : ""} to remote`
        //         });
        //         opts.buttons.push.disabled = false;
        //     }

        //     opts.buttons.commit.onclick = commit;

        //     opts.buttons.push.onclick = async () => {
        //         await commit();
        //         push();
        //     };

        //     if (message) {
        //         container.append(message);
        //     }
        // });
    });

    return container;
}

type Changes = Awaited<ReturnType<typeof ipcEditor.git.status>>;

function ChangesList(changes: Changes, project: Project) {
    const container = document.createElement("div");
    container.classList.add("git-changes");

    const addSection = (subtitle: string, files: string[]) => {
        if (files.length === 0) return;

        const subtitleEl = document.createElement("div");
        subtitleEl.innerText = subtitle;

        container.append(subtitleEl, FilesList(files));
    };

    addSection("Added", changes.Added);
    addSection("Modified", changes.Modified);
    addSection("Deleted", changes.Deleted);

    return container;
}

function FilesList(files: string[]) {
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
                // api.git
                //     .revertFileChanges(opts.project, [file])
                //     .then(opts.didRevertChange);
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
