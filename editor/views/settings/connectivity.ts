import type { WebAddress } from "../../../src/connectivity/types";
import api from "../../api";
import rpc from "../../rpc";
import { CONFIG_TYPE, Connectivity } from "../../api/config/types";
import { constructURL } from "../../api/connectivity/web";
import { Popover } from "../../components/popover";
import { Badge } from "../../components/primitives/badge";
import { Button, ButtonGroup } from "../../components/primitives/button";
import { Icon } from "../../components/primitives/icon";
import {
    InputRadio,
    InputSwitch,
    InputText
} from "../../components/primitives/inputs";

export function Connectivity() {
    const container = document.createElement("div");
    container.classList.add("connectivity");

    container.innerHTML = `<h2>Connectivity</h2>`;

    const autoConnectSwitch = InputSwitch({
        label: "Connect automatically to nearby trusted peers"
    });
    autoConnectSwitch.input.onchange = () => {
        api.connectivity.autoConnect = autoConnectSwitch.input.checked;
    };

    const deviceNameInput = InputText({
        label: "Device Name"
    });
    deviceNameInput.input.onblur = () => {
        api.connectivity.me = {
            id: api.connectivity.me.id,
            name: deviceNameInput.input.value
        };
    };

    container.append(
        autoConnectSwitch.container,
        deviceNameInput.container,
        WebAdresses(),
        NetworkInterfaces()
    );

    api.config.load(CONFIG_TYPE.CONNECTIVITY).then(({ autoConnect, me }) => {
        autoConnectSwitch.input.checked = autoConnect;
        deviceNameInput.input.value = me.name;
    });

    return container;
}

function WebAdresses() {
    const container = document.createElement("div");
    container.classList.add("web-addresses");

    const top = document.createElement("div");

    top.innerHTML = `
        <label>Web Addresses</label>
    `;

    const addButton = Button({
        style: "icon-large",
        iconLeft: "Plus"
    });

    addButton.onclick = () => {
        addButton.disabled = true;

        const remove = () => {
            addButton.disabled = false;
            form.remove();
        };

        const form = document.createElement("form");

        const secureSwitch = InputSwitch({
            label: "Secure <span>(https:, wss:)</span>"
        });
        secureSwitch.input.checked = true;

        const hostnameInput = InputText({
            label: "Hostname"
        });
        const portInput = InputText({
            label: "Port <span>(Leave blank for 80 or 443)</span>"
        });

        const buttons = document.createElement("div");

        const cancelButton = Button({
            text: "Cancel",
            style: "text"
        });
        cancelButton.type = "button";
        cancelButton.onclick = remove;

        const addAddressButton = Button({
            text: "Add"
        });

        buttons.append(cancelButton, addAddressButton);

        form.onsubmit = (e) => {
            e.preventDefault();
            const webAddress: WebAddress = {
                hostname: hostnameInput.input.value,
                port: parseInt(portInput.input.value),
                secure: secureSwitch.input.checked
            };
            remove();
            api.config
                .load(CONFIG_TYPE.CONNECTIVITY)
                .then((connectivityConfig) => {
                    if (!connectivityConfig.webAddresses) {
                        connectivityConfig.webAddresses = [];
                    }
                    connectivityConfig.webAddresses.unshift(webAddress);
                    api.config
                        .save(CONFIG_TYPE.CONNECTIVITY, connectivityConfig)
                        .then(reloadWebAddressesList);
                });
        };

        form.append(
            secureSwitch.container,
            hostnameInput.container,
            portInput.container,
            buttons
        );

        top.insertAdjacentElement("afterend", form);
    };

    top.append(addButton);

    container.append(top);

    const saveWebAddresses = (webAddresses: WebAddress[]) => {
        api.config.load(CONFIG_TYPE.CONNECTIVITY).then((connectivityConfig) => {
            connectivityConfig.webAddresses = webAddresses;
            api.config
                .save(CONFIG_TYPE.CONNECTIVITY, connectivityConfig)
                .then(reloadWebAddressesList);
        });
    };

    let list: HTMLUListElement;
    const reloadWebAddressesList = () => {
        const updatedList = document.createElement("ul");

        api.config.load(CONFIG_TYPE.CONNECTIVITY).then((connectivityConfig) => {
            const items =
                connectivityConfig.webAddresses?.map((webAddress, i) =>
                    WebAddressItem({
                        webAddress,
                        didDelete: () => {
                            connectivityConfig.webAddresses.splice(i, 1);
                            saveWebAddresses(connectivityConfig.webAddresses);
                        }
                    })
                ) ?? [];
            updatedList.append(...items);

            list.replaceWith(updatedList);
            list = updatedList;
        });

        if (!list) {
            container.append(updatedList);
            list = updatedList;
        }
    };
    reloadWebAddressesList();

    return container;
}

type WebAddressItemOpts = {
    webAddress: WebAddress;
    didDelete: () => void;
};

function WebAddressItem(opts: WebAddressItemOpts) {
    const item = document.createElement("li");

    const left = document.createElement("div");

    const address = document.createElement("div");
    address.innerText = opts.webAddress.hostname;
    if (opts.webAddress.port) address.innerText += ":" + opts.webAddress.port;

    left.append(address);

    if (opts.webAddress.secure) {
        left.append(Icon("Lock"));
    }

    const right = document.createElement("div");

    const statusBadgeContainer = document.createElement("div");

    const optionsButton = Button({
        style: "icon-small",
        iconLeft: "Options"
    });

    const deleteButton = Button({
        text: "Delete",
        iconLeft: "Trash",
        color: "red"
    });

    deleteButton.onclick = () => {
        opts.didDelete();
    };

    const content = ButtonGroup([deleteButton]);

    optionsButton.onclick = () =>
        Popover({
            anchor: optionsButton,
            content,
            align: {
                x: "right",
                y: "center"
            }
        });

    right.append(statusBadgeContainer, optionsButton);

    item.append(left, right);

    pingWebAddress(opts.webAddress).then((online) => {
        if (online) {
            statusBadgeContainer.append(
                Badge({
                    text: "Online",
                    type: "success"
                })
            );
        } else {
            statusBadgeContainer.append(
                Badge({
                    text: "Offline"
                })
            );
        }
    });

    return item;
}

function pingWebAddress(webAddress: WebAddress) {
    return new Promise<boolean>((resolve) => {
        const url = constructURL(webAddress, "http");
        rpc()
            .fetch(url + "/ping", {
                timeout: 3000,
                encoding: "utf8"
            })
            .then((res) => resolve(res.body === "pong"))
            .catch(() => resolve(false));
    });
}

function INetItem(name: string) {
    const item = document.createElement("li");

    const nameContainer = document.createElement("div");
    nameContainer.innerText = name;

    const inputRadio = InputRadio();
    inputRadio.input.name = "inet";

    item.append(name, inputRadio.container);

    return {
        item,
        inputRadio
    };
}

function NetworkInterfaces() {
    const container = document.createElement("div");
    container.classList.add("network-interfaces");

    container.innerHTML = `
        <label>Default Network Interface</label>
    `;

    const form = document.createElement("form");

    container.append(form);

    const updateDefaultNetworkInterface = async (inetName: string) => {
        const connectivityConfig = await api.config.load(
            CONFIG_TYPE.CONNECTIVITY
        );
        connectivityConfig.defaultNetworkInterface = inetName;
        api.config.save(CONFIG_TYPE.CONNECTIVITY, connectivityConfig);
    };

    Promise.all([
        api.config.load(CONFIG_TYPE.CONNECTIVITY),
        rpc().connectivity.infos()
    ]).then(([connectivityConfig, { networkInterfaces }]) => {
        if (!networkInterfaces || networkInterfaces.length === 0) return;

        const list = document.createElement("ul");

        const autoItem = INetItem("auto");
        list.append(autoItem.item);

        autoItem.inputRadio.input.checked =
            !connectivityConfig.defaultNetworkInterface;
        autoItem.inputRadio.input.onchange = () => {
            if (autoItem.inputRadio.input.checked)
                updateDefaultNetworkInterface(null);
        };

        networkInterfaces.forEach((inet) => {
            const item = INetItem(inet.name);
            item.inputRadio.input.checked =
                connectivityConfig.defaultNetworkInterface === inet.name;
            item.inputRadio.input.onchange = () => {
                if (item.inputRadio.input.checked)
                    updateDefaultNetworkInterface(inet.name);
            };
            list.append(item.item);
        });

        form.append(list);
    });

    return container;
}
