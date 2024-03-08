import "./index.css";

import type typeRPC from "../../../../src/webview";
import type api from "../../../api";
import { BACK_BUTTON_ID, PACKAGES_BUTTON_ID } from "../../../constants";
import { GitAuth } from "../git-auth";

declare var rpc: typeof typeRPC<typeof api>;

export class Settings {
    backAction: () => void;
    goToPackages: () => void;

    private async renderGitAuths() {
        const container = document.createElement("div");

        const refresh = async () =>
            container.replaceWith(await this.renderGitAuths());

        const settingRow = document.createElement("div");
        settingRow.classList.add("setting-row");

        const title = document.createElement("h2");
        title.innerText = "Git Authentications";
        settingRow.append(title);

        const addButton = document.createElement("button");
        addButton.classList.add("text");
        addButton.innerHTML = await (
            await fetch("assets/icons/add.svg")
        ).text();
        settingRow.append(addButton);

        container.append(settingRow);

        const gitAuths = await rpc().git.getAllAuths();

        const [editIcon, deleteIcon] = await Promise.all([
            (await fetch("/assets/icons/edit.svg")).text(),
            (await fetch("/assets/icons/delete.svg")).text()
        ]);

        const ul = document.createElement("ul");

        addButton.addEventListener("click", async () => {
            addButton.remove();
            const li = document.createElement("li");
            li.append(await GitAuth.renderGitAuthForm(refresh));
            ul.prepend(li);
        });

        Object.entries(gitAuths).forEach(([host, auth]) => {
            const li = document.createElement("li");

            const top = document.createElement("div");
            top.innerHTML = `<div>${host}</div>`;

            const buttonGroup = document.createElement("div");

            const infoOrFormContainer = document.createElement("div");

            const editButton = document.createElement("button");
            editButton.classList.add("text", "small");
            editButton.innerHTML = editIcon;
            editButton.addEventListener("click", async () => {
                editButton.remove();
                infoOrFormContainer.innerHTML = "";
                infoOrFormContainer.append(
                    await GitAuth.renderGitAuthForm(
                        refresh,
                        { host, ...auth },
                        false
                    )
                );
            });
            buttonGroup.append(editButton);

            const deleteButton = document.createElement("button");
            deleteButton.classList.add("text", "small", "danger");
            deleteButton.innerHTML = deleteIcon;
            deleteButton.addEventListener("click", async () => {
                await rpc().git.deleteAuthForHost(host);
                li.remove();
            });
            buttonGroup.append(deleteButton);

            top.append(buttonGroup);
            li.append(top);

            infoOrFormContainer.innerHTML = `<dl>
                <dt>Username</dt>
                <dd>${auth.username}</dd>
                <dt>Email</dt>
                <dd>${auth.email || `<b>No email</b>`}</dd>
                <dt>Password</dt>
                <dd>********</dd>
            </dl`;

            li.append(infoOrFormContainer);

            ul.append(li);
        });

        container.append(ul);

        return container;
    }

    private async renderPackagesRow() {
        const container = document.createElement("div");
        container.classList.add("setting-row");

        const packagesTitle = document.createElement("h2");
        packagesTitle.innerText = "Packages";
        container.append(packagesTitle);

        const packagesButton = document.createElement("button");
        packagesButton.id = PACKAGES_BUTTON_ID;
        packagesButton.classList.add("text", "text-and-icon");
        const [packagesCount, packageIcon] = await Promise.all([
            rpc().packages.count(),
            (await fetch("assets/icons/package.svg")).text()
        ]);
        packagesButton.innerHTML = `<span>${packagesCount || 0} package${packagesCount > 1 ? "s" : ""}</span> ${packageIcon}`;

        packagesButton.addEventListener("click", async () =>
            this.goToPackages()
        );
        container.append(packagesButton);

        return container;
    }

    async render() {
        const container = document.createElement("div");
        container.classList.add("settings");

        const header = document.createElement("header");

        const backButton = document.createElement("button");
        backButton.id = BACK_BUTTON_ID;
        backButton.innerHTML = await (
            await fetch("/assets/icons/chevron.svg")
        ).text();
        backButton.classList.add("text");
        backButton.addEventListener("click", this.backAction);
        header.append(backButton);

        const title = document.createElement("h1");
        title.innerText = "Settings";
        header.append(title);

        container.append(header);

        container.append(await this.renderPackagesRow());

        container.append(await this.renderGitAuths());

        return container;
    }
}
