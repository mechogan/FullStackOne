import api from "../../../api";
import { GitAuths } from "../../../api/config/types";
import { Popover } from "../../../components/popover";
import { Button, ButtonGroup } from "../../../components/primitives/button";

export function GitAuthentications() {
    const container = document.createElement("div");
    container.classList.add("git-authentications");

    const top = document.createElement("div");

    top.innerHTML = "<h2>Git Authentications</h2>";

    const addButton = Button({
        text: "Add",
        iconRight: "Plus"
    });

    top.append(addButton);

    const list = document.createElement("ul");

    container.append(top, list);

    api.git.getAllAuths().then((gitAuths) => {
        list.append(...Object.entries(gitAuths).map(GitAuthItem));
    });

    return container;
}

function GitAuthItem(gitAuth: [string, GitAuths[""]]) {
    const [hostname, info] = gitAuth;

    const item = document.createElement("li");

    const top = document.createElement("div");

    top.innerHTML = `<div>${hostname}</div>`;

    const optionsButton = Button({
        style: "icon-small",
        iconLeft: "Options"
    });

    optionsButton.onclick = () => {
        const updateButton = Button({
            text: "Update",
            iconLeft: "Edit"
        });

        const deleteButton = Button({
            text: "Delete",
            color: "red",
            iconLeft: "Trash"
        });
        deleteButton.onclick = () => {
            api.git.deleteAuthForHost(hostname);
            item.remove();
        }
        
        const buttonGroup = ButtonGroup([
            updateButton,
            deleteButton,
        ]);

        Popover({
            anchor: optionsButton,
            content: buttonGroup,
            align: {
                x: "right",
                y: "top"
            }
        })
    }

    top.append(optionsButton);
    item.append(top);

    const username = document.createElement("div");
    username.innerHTML = `
        <label>Username</label>
        <div>${info.username || "-"}</div>
    `;

    const email = document.createElement("div");
    email.innerHTML = `
        <label>Email</label>
        <div>${info.email || "-"}</div>
    `;

    const password = document.createElement("div");
    password.innerHTML = `
        <label>Password</label>
        <div>********</div>
    `;

    item.append(username, email, password);

    return item;
}
