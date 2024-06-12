import "./index.css";
import { BACK_BUTTON_ID, BG_COLOR, PACKAGES_BUTTON_ID } from "../../constants";
import api from "../../api";
import { CONFIG_TYPE } from "../../api/config/types";
import rpc from "../../rpc";
import gitAuth from "../git-auth";
import projectView from "../project"
import stackNavigation from "../../stack-navigation";

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
                location: await rpc().directories.nodeModules(),
                createdDate: null
            });
            projectView.packagesView = true;
            stackNavigation.navigate(await projectView.render(), BG_COLOR)
        });
        container.append(packagesButton);

        return container;
    }

    private async renderConnectivity() {
        const container = document.createElement("div");

        const connectivityTitle = document.createElement("h2");
        connectivityTitle.innerText = "Connectivity";
        container.append(connectivityTitle);

        const row = document.createElement("div");
        row.classList.add("setting-row");

        row.innerHTML = `<label>Auto connect to nearby trusted peers.</label>`;

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

        const { networkInterfaces } = await rpc().connectivity.infos();

        if (networkInterfaces?.length > 0) {
            const row3 = document.createElement("div");
            row3.classList.add("default-inet");

            const inetLabel = document.createElement("label");
            inetLabel.innerText = "Default Network Interface";
            row3.append(inetLabel);

            const updateDefaultNetworkInterface = async (inet: string) => {
                connectivitySettings.defaultNetworkInterface = inet;
                await api.config.save(
                    CONFIG_TYPE.CONNECTIVITY,
                    connectivitySettings
                );
                api.connectivity.advertise();
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

            row3.append(ul);

            const clearBtn = document.createElement("button");
            clearBtn.classList.add("small");
            clearBtn.innerText = "clear";
            clearBtn.addEventListener("click", () => {
                inetSelections.forEach((radio) => (radio.checked = false));
                updateDefaultNetworkInterface(null);
            });
            row3.append(clearBtn);

            container.append(row3);
        }

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
        backButton.addEventListener("click", () => stackNavigation.back());
        header.append(backButton);

        const title = document.createElement("h1");
        title.innerText = "Settings";
        header.append(title);

        container.append(header);

        container.append(await this.renderPackagesRow());

        container.append(await this.renderConnectivity());

        container.append(await this.renderGitAuths());

        return container;
    }
}

export default new Settings();