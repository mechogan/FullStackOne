// import "./index.css";
import { BACK_BUTTON_ID, BG_COLOR, PACKAGES_BUTTON_ID } from "../../constants";
import api from "../../api";
import { CONFIG_TYPE } from "../../api/config/types";
import rpc from "../../rpc";
import gitAuth from "../git-auth";
import projectView from "../project";
import stackNavigation from "../../stack-navigation";
import { constructURL } from "../../api/connectivity/web";
import version from "./version";

export class Settings {
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

        const gitAuths = await api.git.getAllAuths();

        const [editIcon, deleteIcon] = await Promise.all([
            (await fetch("/assets/icons/edit.svg")).text(),
            (await fetch("/assets/icons/delete.svg")).text()
        ]);

        const ul = document.createElement("ul");
        ul.classList.add("git-auths");

        addButton.addEventListener("click", async () => {
            addButton.remove();
            const li = document.createElement("li");
            li.append(
                await gitAuth.renderGitAuthForm(async (gitAuth) => {
                    await api.git.saveGitAuth(gitAuth);
                    refresh();
                }, refresh)
            );
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
                    await gitAuth.renderGitAuthForm(
                        async (gitAuth) => {
                            await api.git.saveGitAuth(gitAuth);
                            refresh();
                        },
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
                await api.git.deleteAuthForHost(host);
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
            api.packages.count(),
            (await fetch("assets/icons/package.svg")).text()
        ]);
        packagesButton.innerHTML = `<span>${packagesCount || 0} package${packagesCount > 1 ? "s" : ""}</span> ${packageIcon}`;

        packagesButton.addEventListener("click", async () => {
            projectView.setProject({
                title: "Packages",
                id: null,
                location: await rpc().directories.nodeModulesDirectory(),
                createdDate: null
            });
            projectView.packagesView = true;
            stackNavigation.navigate(await projectView.render(), BG_COLOR);
        });
        container.append(packagesButton);

        return container;
    }

    pingStatusCache = new Map<string, Promise<boolean>>();
    private async renderConnectivity() {
        const container = document.createElement("div");

        const connectivityTitle = document.createElement("h2");
        connectivityTitle.innerText = "Connectivity";
        container.append(connectivityTitle);

        const row = document.createElement("div");
        row.classList.add("setting-row");

        row.innerHTML = `<label>Connect automatically to nearby trusted peers.</label>`;

        const switchButton = document.createElement("label");
        switchButton.classList.add("switch");
        switchButton.innerHTML = `<span class="slider round"></span>`;

        const autoConnectInput = document.createElement("input");
        autoConnectInput.type = "checkbox";
        const connectivitySettings = await api.config.load(
            CONFIG_TYPE.CONNECTIVITY
        );
        autoConnectInput.checked = connectivitySettings.autoConnect;
        switchButton.prepend(autoConnectInput);

        autoConnectInput.addEventListener("change", async function () {
            connectivitySettings.autoConnect = this.checked;
            await api.config.save(
                CONFIG_TYPE.CONNECTIVITY,
                connectivitySettings
            );
            await api.connectivity.init();
        });

        row.append(switchButton);

        container.append(row);

        const row2 = document.createElement("div");
        row2.classList.add("setting-row");

        const nameInputLabel = document.createElement("label");
        nameInputLabel.innerText = "Display name";

        const connectivityNameInput = document.createElement("input");
        connectivityNameInput.type = "text";
        connectivityNameInput.value = connectivitySettings.me.name;

        const saveConnectivityName = async (name: string) => {
            connectivitySettings.me.name = name;
            await api.config.save(
                CONFIG_TYPE.CONNECTIVITY,
                connectivitySettings
            );
            await api.connectivity.init();
        };

        let saveThrottler: ReturnType<typeof setTimeout>;
        connectivityNameInput.addEventListener("change", () => {
            if (saveThrottler) {
                clearTimeout(saveThrottler);
            }

            const value = connectivityNameInput.value;
            saveThrottler = setTimeout(async () => {
                saveThrottler = null;
                saveConnectivityName(value);
            }, 250);
        });

        connectivityNameInput.addEventListener("blur", async () => {
            if (connectivityNameInput.value.trim() === "") {
                const defaultName = await rpc().connectivity.name();
                connectivityNameInput.value = defaultName;
                saveConnectivityName(defaultName);
            }
        });

        row2.append(nameInputLabel);
        row2.append(connectivityNameInput);

        container.append(row2);

        const row4 = document.createElement("div");
        row4.classList.add("web-addr");

        const topRow4 = document.createElement("div");
        topRow4.classList.add("setting-row");

        topRow4.innerHTML = `<label>Web Addresses</label>`;

        const webAddrs = document.createElement("ul");

        const [lockIcon, deleteIcon] = await Promise.all([
            (await fetch("assets/icons/lock.svg")).text(),
            (await fetch("assets/icons/delete.svg")).text()
        ]);

        connectivitySettings.webAddresses?.forEach(async (webAddr, index) => {
            const li = document.createElement("li");
            li.innerHTML = `
                <div>
                <span>${constructURL(webAddr, "")}</span>
                ${webAddr.secure ? `<span class="secure">${lockIcon}</span>` : ""}
                </div>
            `;

            const right = document.createElement("div");

            const status = document.createElement("div");
            status.classList.add("badge", "status");
            status.innerText = "Offline";
            right.append(status);

            const url = constructURL(webAddr, "http");
            let promise = this.pingStatusCache.get(url);

            if (!promise) {
                promise = new Promise<boolean>((resolve) => {
                    rpc()
                        .fetch(url + "/ping", { encoding: "utf8" })
                        .then((res) => resolve(res.body === "pong"))
                        .catch(() => resolve(false));
                });
                this.pingStatusCache.set(url, promise);
            }

            promise.then((online) => {
                if (online) {
                    status.innerText = "Online";
                    status.classList.add("success");
                }
            });

            const deleteButton = document.createElement("button");
            deleteButton.classList.add("text", "small", "danger");
            deleteButton.innerHTML = deleteIcon;
            deleteButton.addEventListener("click", async () => {
                li.remove();
                connectivitySettings.webAddresses.splice(index, 1);

                await api.config.save(
                    CONFIG_TYPE.CONNECTIVITY,
                    connectivitySettings
                );
                container.replaceWith(await this.renderConnectivity());
            });
            right.append(deleteButton);

            li.append(right);

            webAddrs.append(li);
        });

        const addButton = document.createElement("button");
        addButton.classList.add("small", "text");
        addButton.innerHTML = await (
            await fetch("assets/icons/add.svg")
        ).text();
        addButton.addEventListener("click", async () => {
            addButton.remove();
            const li = document.createElement("li");
            const form = document.createElement("form");

            const addressInputLabel = document.createElement("label");
            addressInputLabel.innerText = "Hostname";
            form.append(addressInputLabel);

            const addressInput = document.createElement("input");
            form.append(addressInput);

            const portInputLabel = document.createElement("label");
            portInputLabel.innerText = "Port (leave blank for 80, 443)";
            form.append(portInputLabel);

            const portInput = document.createElement("input");
            portInput.type = "tel";
            form.append(portInput);

            const secureRow = document.createElement("div");

            const secureInputLabel = document.createElement("label");
            secureInputLabel.innerText = "Secure (https:, wss:)";
            secureRow.append(secureInputLabel);

            const secureSwitch = document.createElement("label");
            secureSwitch.classList.add("switch");
            secureSwitch.innerHTML = `<span class="slider round"></span>`;

            const secureInput = document.createElement("input");
            secureInput.type = "checkbox";
            secureInput.checked = true;
            secureSwitch.prepend(secureInput);

            secureRow.append(secureSwitch);

            form.append(secureRow);

            const buttonGroup = document.createElement("div");

            const confirmButton = document.createElement("button");
            confirmButton.classList.add("text");
            confirmButton.innerHTML = await (
                await fetch("assets/icons/check.svg")
            ).text();
            buttonGroup.append(confirmButton);

            const cancelButton = document.createElement("button");
            cancelButton.classList.add("text", "danger");
            cancelButton.innerHTML = await (
                await fetch("assets/icons/close.svg")
            ).text();
            cancelButton.addEventListener("click", async (e) => {
                e.preventDefault();
                li.remove();
                container.replaceWith(await this.renderConnectivity());
            });
            buttonGroup.append(cancelButton);

            form.append(buttonGroup);

            form.addEventListener("submit", async (e) => {
                e.preventDefault();

                if (!connectivitySettings.webAddresses) {
                    connectivitySettings.webAddresses = [];
                }

                const port = parseInt(portInput.value);

                connectivitySettings.webAddresses.push({
                    hostname: addressInput.value,
                    port: isNaN(port) ? null : port,
                    secure: secureInput.checked
                });

                await api.config.save(
                    CONFIG_TYPE.CONNECTIVITY,
                    connectivitySettings
                );

                li.remove();
                container.replaceWith(await this.renderConnectivity());
            });

            li.append(form);
            webAddrs.prepend(li);
        });
        topRow4.append(addButton);

        row4.append(topRow4);

        row4.append(webAddrs);

        container.append(row4);

        const { networkInterfaces } = await rpc().connectivity.infos();

        if (networkInterfaces?.length > 0) {
            const row3 = document.createElement("div");
            row3.classList.add("default-inet");

            const topRow = document.createElement("div");

            const inetLabel = document.createElement("label");
            inetLabel.innerText = "Default Network Interface";
            topRow.append(inetLabel);

            row3.append(topRow);

            const updateDefaultNetworkInterface = async (inet: string) => {
                connectivitySettings.defaultNetworkInterface = inet;
                await api.config.save(
                    CONFIG_TYPE.CONNECTIVITY,
                    connectivitySettings
                );
                api.connectivity.init();
            };

            const ul = document.createElement("ul");
            const inetSelections = networkInterfaces.map(({ name }) => {
                const li = document.createElement("li");
                const label = document.createElement("label");
                label.innerText = name;
                label.setAttribute("for", name);
                li.append(label);
                const radio = document.createElement("input");
                radio.id = name;
                radio.name = "default_network_interface";
                radio.type = "radio";
                radio.value = name;

                radio.checked =
                    name === connectivitySettings.defaultNetworkInterface;

                li.append(radio);
                ul.append(li);

                radio.addEventListener("change", () => {
                    if (!radio.checked) return;

                    updateDefaultNetworkInterface(name);
                });

                return radio;
            });

            const clearBtn = document.createElement("button");
            clearBtn.classList.add("small", "text");
            clearBtn.innerText = "clear";
            clearBtn.addEventListener("click", () => {
                inetSelections.forEach((radio) => (radio.checked = false));
                updateDefaultNetworkInterface(null);
            });
            topRow.append(clearBtn);

            row3.append(ul);

            container.append(row3);
        }

        return container;
    }

    async render() {
        this.pingStatusCache = new Map();

        const container = document.createElement("div");
        container.classList.add("settings");

        const header = document.createElement("header");

        const backButton = document.createElement("button");
        backButton.id = BACK_BUTTON_ID;
        backButton.innerHTML = await (
            await fetch("/assets/icons/chevron.svg")
        ).text();
        backButton.classList.add("text");
        backButton.addEventListener("click", () => stackNavigation.back());
        header.append(backButton);

        const title = document.createElement("h1");
        title.innerText = "Settings";
        header.append(title);

        container.append(header);

        container.append(await this.renderPackagesRow());

        container.append(await this.renderConnectivity());

        container.append(await this.renderGitAuths());

        container.append(await version());

        return container;
    }
}

export default new Settings();
