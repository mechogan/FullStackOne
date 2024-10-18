import api from "../../../../api";
import { Project } from "../../../../api/config/types";
import { Loader } from "../../../../components/loader";
import { Message } from "../../../../components/message";
import { Popover } from "../../../../components/popover";
import { Badge } from "../../../../components/primitives/badge";
import { Button, ButtonGroup } from "../../../../components/primitives/button";
import { Icon } from "../../../../components/primitives/icon";

type BranchesOpts = {
    project: Project;
    didChangeBranch: () => void;
    goBack: () => void;
    removeDialog: () => void;
};

export function Branches(opts: BranchesOpts) {
    const container = document.createElement("div");
    container.classList.add("git-branches");

    const top = document.createElement("div");

    const backButton = Button({
        style: "icon-large",
        iconLeft: "Arrow"
    });
    backButton.onclick = opts.goBack;

    const title = document.createElement("h3");
    title.innerText = "Branches";

    const createButton = Button({
        text: "Create"
    });

    top.append(backButton, title, createButton);

    const closeButton = Button({
        text: "Close",
        style: "text"
    });

    closeButton.onclick = opts.removeDialog;

    container.append(
        top,
        BranchesList({
            project: opts.project,
            didChangeBranch: opts.didChangeBranch
        }),
        closeButton
    );

    return container;
}

type BranchesListOpts = {
    project: Project;
    didChangeBranch: () => void;
};

function BranchesList(opts: BranchesListOpts) {
    const container = document.createElement("div");
    container.classList.add("git-branch-list");

    Promise.all([
        api.git.branch.getAll(opts.project),
        api.git.currentBranch(opts.project),
        api.git.changes(opts.project)
    ]).then(([branches, currentBranch, changes]) => {
        let hasUncommittedChanges =
            changes.added.length ||
            changes.modified.length ||
            changes.deleted.length;
        if (hasUncommittedChanges) {
            container.append(
                Message({
                    style: "warning",
                    text: "You have uncommitted changes. Commit before changing branch."
                })
            );
        }

        const branchesList = document.createElement("ul");
        container.append(branchesList);

        const allBranches = Array.from(
            new Set(branches.local.concat(branches.remote))
        ).filter((name) => name !== "HEAD");

        const checkoutButtonsAndOptions = [];

        const items = allBranches.sort().map((branch) => {
            const item = document.createElement("li");

            const isCurrent = branch === currentBranch;

            if (isCurrent) {
                const icon = Icon("Arrow 2");
                checkoutButtonsAndOptions.push(icon);
                item.append(icon);
            } else if (hasUncommittedChanges) {
                item.append(document.createElement("div"));
            } else {
                const checkoutButton = Button({
                    style: "icon-small",
                    iconLeft: "Arrow Corner"
                });

                checkoutButtonsAndOptions.push(checkoutButton);

                checkoutButton.onclick = () => {
                    checkoutButton.replaceWith(Loader());
                    checkoutButtonsAndOptions.forEach((button) => {
                        button.replaceWith(document.createElement("div"));
                    });

                    api.git.checkout(opts.project, branch).then(() => {
                        opts.didChangeBranch();
                        container.replaceWith(BranchesList(opts));
                    });
                };

                item.append(checkoutButton);
            }

            const branchName = document.createElement("div");
            branchName.innerText = branch;
            item.append(branchName);

            let isLocal = branches.local.includes(branch);

            if (isLocal) {
                if (branches.remote.includes(branch)) {
                    item.append(document.createElement("div"));
                } else {
                    item.append(
                        Badge({
                            text: "local-only",
                            type: "info"
                        })
                    );
                }
            } else {
                item.append(
                    Badge({
                        text: "remote-only"
                    })
                );
            }

            if (isLocal && !isCurrent) {
                const optionsButton = Button({
                    style: "icon-small",
                    iconLeft: "Options"
                });

                checkoutButtonsAndOptions.push(optionsButton);

                item.append(optionsButton);

                const deleteButton = Button({
                    text: "Delete",
                    iconLeft: "Trash",
                    color: "red"
                });

                deleteButton.onclick = () => {
                    api.git.branch.delete(opts.project, branch).then(() => {
                        container.replaceWith(BranchesList(opts));
                    });
                };

                optionsButton.onclick = () => {
                    Popover({
                        anchor: optionsButton,
                        content: ButtonGroup([deleteButton]),
                        align: {
                            x: "right",
                            y: "center"
                        }
                    });
                };
            } else {
                item.append(document.createElement("div"));
            }

            return item;
        });

        branchesList.append(...items);
    });

    return container;
}
