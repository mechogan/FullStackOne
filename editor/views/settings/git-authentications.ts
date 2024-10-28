import api from "../../api";
import { CONFIG_TYPE, GitAuths } from "../../api/config/types";
import { Popover } from "../../components/popover";
import { Button, ButtonGroup } from "../../components/primitives/button";
import { InputText } from "../../components/primitives/inputs";

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

    addButton.onclick = () => {
        addButton.disabled = true;

        const form = GitAuthForm("Add");

        const remove = () => {
            addButton.disabled = false;
            form.form.remove();
        };

        form.cancelButton.onclick = remove;

        form.form.onsubmit = (e) => {
            e.preventDefault();
            remove();
            api.git
                .saveGitAuth(form.hostnameInput.input.value, {
                    username: form.usernameInput.input.value,
                    email: form.emailInput.input.value,
                    password: form.passwordInput.input.value
                })
                .then(reloadGitAuths);
        };

        top.insertAdjacentElement("afterend", form.form);
    };

    container.append(top);

    let list: HTMLUListElement;
    const reloadGitAuths = () => {
        const updatedList = document.createElement("ul");

        api.config.load(CONFIG_TYPE.GIT).then((gitAuths) => {
            updatedList.append(
                ...Object.entries(gitAuths).map(([hostname, gitAuth]) =>
                    GitAuthItem({
                        hostname,
                        gitAuth,
                        didUpdateOrDelete: reloadGitAuths
                    })
                )
            );

            list.replaceWith(updatedList);
            list = updatedList;
        });

        if (!list) {
            container.append(updatedList);
            list = updatedList;
        }
    };
    reloadGitAuths();

    return container;
}

type GitAuthOpts = {
    hostname: string;
    gitAuth: GitAuths[""];
    didUpdateOrDelete: () => void;
};

function GitAuthItem(opts: GitAuthOpts) {
    const item = document.createElement("li");

    const top = document.createElement("div");

    top.innerHTML = `<div>${opts.hostname}</div>`;

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
            const form = GitAuthForm("Save");

            form.hostnameInput.input.value = opts.hostname;
            form.usernameInput.input.value = opts.gitAuth.username;
            form.emailInput.input.value = opts.gitAuth.email;

            const passwordContainer = document.createElement("div");
            passwordContainer.innerHTML = `
                <div><label>Password</label></div>
                <div>To change password, delete and re-create</div>
            `;

            form.passwordInput.container.replaceWith(passwordContainer);

            form.cancelButton.onclick = opts.didUpdateOrDelete;

            form.form.onsubmit = (e) => {
                e.preventDefault();

                if (form.hostnameInput.input.value !== opts.hostname) {
                    api.git.deleteAuthForHost(opts.hostname);
                }

                api.git
                    .saveGitAuth(form.hostnameInput.input.value, {
                        username: form.usernameInput.input.value,
                        email: form.emailInput.input.value,
                        password: opts.gitAuth.password
                    })
                    .then(opts.didUpdateOrDelete);
            };

            setTimeout(() => item.replaceWith(form.form), 1);
        };

        const deleteButton = Button({
            text: "Delete",
            color: "red",
            iconLeft: "Trash"
        });
        deleteButton.onclick = () => {
            api.git
                .deleteAuthForHost(opts.hostname)
                .then(opts.didUpdateOrDelete);
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
    item.append(top);

    const username = document.createElement("div");
    username.innerHTML = `
        <label>Username</label>
        <div>${opts.gitAuth.username || "-"}</div>
    `;

    const email = document.createElement("div");
    email.innerHTML = `
        <label>Email</label>
        <div>${opts.gitAuth.email || "-"}</div>
    `;

    const password = document.createElement("div");
    password.innerHTML = `
        <label>Password</label>
        <div>********</div>
    `;

    item.append(username, email, password);

    return item;
}

function GitAuthForm(submitLabel: string) {
    const form = document.createElement("form");

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
