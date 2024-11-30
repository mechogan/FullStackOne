import { createElement } from "../../components/element";
import { Popover } from "../../components/popover";
import { Button, ButtonGroup } from "../../components/primitives/button";
import { InputText } from "../../components/primitives/inputs";
import { createRefresheable } from "../../components/refresheable";
import config from "../../lib/config";
import { CONFIG_TYPE, GitAuths } from "../../types";

let gitAuthRefresh: ReturnType<typeof createRefresheable>["refresh"];
const refreshGitAuthsList = () => {
    gitAuthRefresh?.();
};
export function GitAuthentications() {
    const container = document.createElement("div");
    container.classList.add("git-authentications");

    const top = document.createElement("div");

    top.innerHTML = "<h2>Git Authentications</h2>";

    const addButton = Button({
        style: "icon-large",
        iconLeft: "Plus"
    });

    top.append(addButton);

    let create = false;
    const renderForm = () => {
        if (create) {
            addButton.style.display = "none";
            return GitAuthCreateForm((refreshList: boolean) => {
                create = false;
                createFormRefresheable.refresh();
                if (refreshList) {
                    gitAuthListRefresheable.refresh();
                }
            });
        } else {
            addButton.style.display = "flex";
            return createElement("div");
        }
    };

    const createFormRefresheable = createRefresheable(renderForm);

    addButton.onclick = () => {
        create = true;
        createFormRefresheable.refresh();
    };

    container.append(top, createFormRefresheable.element);

    const gitAuthListRefresheable = createRefresheable(GitAuthsList);
    container.append(gitAuthListRefresheable.element);
    gitAuthRefresh = gitAuthListRefresheable.refresh;
    gitAuthRefresh();

    return container;
}

async function GitAuthsList() {
    const container = createElement("ul");

    const gitAuths = await config.get(CONFIG_TYPE.GIT);
    const items = Object.entries(gitAuths).map(GitAuthItem);

    container.append(...items);

    return container;
}

function GitAuthItem(gitAuth: [string, GitAuths[""]]) {
    const item = createElement("li");

    let update = false;

    const renderInfos = () => {
        const container = createElement("div");

        const top = document.createElement("div");

        top.innerHTML = `<div>${gitAuth[0]}</div>`;

        const optionsButton = Button({
            style: "icon-small",
            iconLeft: "Options"
        });

        optionsButton.onclick = () => {
            const updateButton = Button({
                text: "Update",
                iconLeft: "Edit"
            });

            updateButton.onclick = () => {
                update = true;
                refresheable.refresh();
            };

            const deleteButton = Button({
                text: "Delete",
                color: "red",
                iconLeft: "Trash"
            });
            deleteButton.onclick = async () => {
                const gitAuthConfigs = await config.get(
                    CONFIG_TYPE.GIT
                );
                delete gitAuthConfigs[gitAuth[0]];
                await config.save(CONFIG_TYPE.GIT, gitAuthConfigs);
                refreshGitAuthsList();
            };

            const buttonGroup = ButtonGroup([updateButton, deleteButton]);

            Popover({
                anchor: optionsButton,
                content: buttonGroup,
                align: {
                    x: "right",
                    y: "top"
                }
            });
        };

        top.append(optionsButton);
        container.append(top);

        const username = document.createElement("div");
        username.innerHTML = `
            <label>Username</label>
            <div>${gitAuth[1].username || "-"}</div>
        `;

        const email = document.createElement("div");
        email.innerHTML = `
        <label>Email</label>
        <div>${gitAuth[1].email || "-"}</div>
    `;

        const password = document.createElement("div");
        password.innerHTML = `
        <label>Password</label>
        <div>********</div>
    `;

        container.append(username, email, password);

        return container;
    };

    const renderForm = () => {
        const formComponents = GitAuthForm("Update");

        formComponents.cancelButton.onclick = () => {
            update = false;
            refresheable.refresh();
        };

        formComponents.hostnameInput.input.value = gitAuth[0];
        formComponents.usernameInput.input.value = gitAuth[1].username;
        formComponents.emailInput.input.value = gitAuth[1].email;

        const noPasswordShown = createElement("div");
        noPasswordShown.innerText = "To change password, delete and re-create";
        formComponents.passwordInput.input.replaceWith(noPasswordShown);

        formComponents.form.onsubmit = async (e) => {
            e.preventDefault();

            formComponents.submitButton.disabled = true;

            const gitAuthConfigs = await config.get(CONFIG_TYPE.GIT);
            gitAuthConfigs[formComponents.hostnameInput.input.value] = {
                username: formComponents.usernameInput.input.value,
                email: formComponents.emailInput.input.value,
                password: gitAuth[1].password
            };

            if (formComponents.hostnameInput.input.value !== gitAuth[0]) {
                delete gitAuthConfigs[gitAuth[0]];
            }

            await config.save(CONFIG_TYPE.GIT, gitAuthConfigs);
            refreshGitAuthsList();
        };

        return formComponents.form;
    };

    const renderItem = () => {
        if (update) {
            return renderForm();
        } else {
            return renderInfos();
        }
    };

    const refresheable = createRefresheable(renderItem);
    item.append(refresheable.element);
    refresheable.refresh();

    return item;
}

function GitAuthForm(submitLabel: string) {
    const form = createElement("form");

    const hostnameInput = InputText({
        label: "Hostname"
    });
    const usernameInput = InputText({
        label: "Username"
    });
    const emailInput = InputText({
        label: "Email <span>(Optional)</span>"
    });
    const passwordInput = InputText({
        label: "Password"
    });
    passwordInput.input.type = "password";

    const buttons = document.createElement("div");
    const cancelButton = Button({
        style: "text",
        text: "Cancel"
    });
    cancelButton.type = "button";

    const submitButton = Button({
        text: submitLabel
    });
    buttons.append(cancelButton, submitButton);

    form.append(
        hostnameInput.container,
        usernameInput.container,
        emailInput.container,
        passwordInput.container,
        buttons
    );

    return {
        hostnameInput,
        usernameInput,
        emailInput,
        passwordInput,
        cancelButton,
        submitButton,
        form
    };
}

function GitAuthCreateForm(close: (refreshList: boolean) => void) {
    const formComponents = GitAuthForm("Add");

    formComponents.cancelButton.onclick = () => close(false);

    formComponents.form.onsubmit = async (e) => {
        e.preventDefault();

        if (!formComponents.hostnameInput.input.value) {
            close(false);
            return;
        }

        formComponents.submitButton.disabled = true;

        const gitAuthConfigs = await config.get(CONFIG_TYPE.GIT);
        gitAuthConfigs[formComponents.hostnameInput.input.value] = {
            username: formComponents.usernameInput.input.value,
            password: formComponents.passwordInput.input.value,
            email: formComponents.emailInput.input.value
        };
        await config.save(CONFIG_TYPE.GIT, gitAuthConfigs);
        close(true);
    };

    return formComponents.form;
}
