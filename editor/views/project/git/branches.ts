import { toggleCommitAndBranchView } from ".";
import { createElement } from "../../../components/element";
import { Loader } from "../../../components/loader";
import { Message } from "../../../components/message";
import { Popover } from "../../../components/popover";
import { Badge } from "../../../components/primitives/badge";
import { Button, ButtonGroup } from "../../../components/primitives/button";
import { Icon } from "../../../components/primitives/icon";
import { InputText } from "../../../components/primitives/inputs";
import { createRefresheable } from "../../../components/refresheable";
import { ipcEditor } from "../../../ipc";
import { Project } from "../../../types";

export function Branches(project: Project, closeButton: HTMLButtonElement) {
    const container = createElement("div");
    container.classList.add("git-branches");

    const top = document.createElement("div");

    const backButton = Button({
        style: "icon-large",
        iconLeft: "Arrow"
    });
    backButton.onclick = toggleCommitAndBranchView;

    const title = document.createElement("h3");
    title.innerText = "Branches";

    const createButton = Button({
        style: "icon-large",
        iconLeft: "Plus"
    });

    top.append(
        backButton, 
        title, 
        createButton
    );

    let showCreateBranchForm = false;

    createButton.onclick = () => {
        showCreateBranchForm = true;
        createBranchRefresheable.refresh()
    };
    
    const renderBranchForm = () => {
        if(showCreateBranchForm) {
            createButton.style.display = "none";
            return CreateBranchForm(project, () => {
                showCreateBranchForm = false;
                createBranchRefresheable.refresh();
            })
        } else {
            createButton.style.display = null;
            return createElement("div");
        }
    }

    const createBranchRefresheable = createRefresheable(renderBranchForm)
    createBranchRefresheable.refresh();

    const renderBranchesList = () => BranchesList(project)
    const branchesListRefresheable = createRefresheable(renderBranchesList);
    branchesListRefresheable.refresh();

    container.append(
        top, 
        createBranchRefresheable.element,
        branchesListRefresheable.element,
        closeButton
    );

    return container;
}

async function BranchesList(project: Project) {
    const container = createElement("ul");
    container.classList.add("git-branch-list");

    const [branches, head] = await Promise.all([
        ipcEditor.git.branches(project.id),
        ipcEditor.git.head(project.id)
    ])


    const items = branches
        .sort()
        .map(branch => {
            const item = document.createElement("li");

            const isCurrent = branch === head.Name;
    
            const branchName = document.createElement("div");
            branchName.innerText = branch;
            item.append(branchName);

            return item;
        })

    container.append(...items);

    return container;
}

function CreateBranchForm(project: Project, cancel: () => void) {
    const form = createElement("form");
    form.classList.add("create-branch-form");

    const branchNameInput = InputText({
        label: "Branch name"
    });

    const cancelButton = Button({
        style: "text",
        text: "Cancel"
    });
    cancelButton.type = "button";
    cancelButton.onclick = cancel;

    const createButton = Button({
        text: "Create"
    });

    const buttons = document.createElement("div");
    buttons.append(cancelButton, createButton);

    form.onsubmit = (e) => {
        e.preventDefault();
    };

    form.append(branchNameInput.container, buttons);

    setTimeout(() => branchNameInput.input.focus(), 1);

    return form;
}
