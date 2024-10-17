import api from "../../../../api";
import { Project } from "../../../../api/config/types";
import { Dialog } from "../../../../components/dialog";
import { Button } from "../../../../components/primitives/button";
import { Icon } from "../../../../components/primitives/icon";

export function Git(project: Project) {
    const container = document.createElement("div");
    container.classList.add("git-dialog");

    const top = document.createElement("div");
    top.classList.add("git-top");

    const branchButton = Button({
        style: "icon-large",
        iconLeft: "Git Branch"
    });

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
    const pushButton = Button({
        text: "Push"
    });

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

function Author(project: Project) {
    const container = document.createElement("div");
    container.classList.add("git-author");

    const editButton = Button({
        style: "icon-small",
        iconLeft: "Edit"
    });

    const infos = document.createElement("div");
    infos.innerHTML = `
        <div>${project.gitRepository.name || "No Username"}</div>
        <div>${project.gitRepository.email || "No Email"}</div>
    `;

    container.append(Icon("User"), infos, editButton);

    return container;
}

function Status(project: Project) {
    const container = document.createElement("div");
    container.classList.add("git-status");

    container.innerText = "Calculating diffs...";

    return container;
}
