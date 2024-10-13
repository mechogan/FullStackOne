import type { WebAddress } from "../../../../src/connectivity/types";
import api from "../../../api";
import { CONFIG_TYPE } from "../../../api/config/types";
import { constructURL } from "../../../api/connectivity/web";
import { Popover } from "../../../components/popover";
import { Badge } from "../../../components/primitives/badge";
import { Button, ButtonGroup } from "../../../components/primitives/button";
import { Icon } from "../../../components/primitives/icon";
import { InputSwitch, InputText } from "../../../components/primitives/inputs";

export function Connectivity() {
    const container = document.createElement("div");
    container.classList.add("connectivity");

    container.innerHTML = `<h2>Connectivity</h2>`;

    const autoConnectSwitch = InputSwitch({
        label: "Connect automatically to nearby trusted peers"
    });

    const deviceNameInput = InputText({
        label: "Device Name"
    });

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
        text: "Add",
        iconRight: "Plus"
    });

    top.append(addButton);

    const list = document.createElement("ul");

    container.append(top, list);

    api.config.load(CONFIG_TYPE.CONNECTIVITY).then(({ webAddresses }) => {
        const items = webAddresses.map(WebAddressItem);
        list.append(...items);
    });

    return container;
}

function WebAddressItem(webAddress: WebAddress) {
    const item = document.createElement("li");

    const left = document.createElement("div");

    const address = document.createElement("div");
    address.innerText = webAddress.hostname;
    if (webAddress.port) address.innerText += ":" + webAddress.port;

    left.append(address);

    if (webAddress.secure) {
        left.append(Icon("Lock"));
    }

    const right = document.createElement("div");

    const statusBadgeContainer = document.createElement("div");

    const optionsButton = Button({
        style: "icon-small",
        iconLeft: "Options"
    });

    const content = ButtonGroup([
        Button({
            text: "Delete",
            iconLeft: "Trash",
            color: "red"
        })
    ]);

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

    pingWebAddress(webAddress).then((online) => {
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
            .fetch(url + "/ping", { encoding: "utf8" })
            .then((res) => resolve(res.body === "pong"))
            .catch(() => resolve(false));
    });
}

function NetworkInterfaces() {
    const container = document.createElement("div");
    container.classList.add("network-interfaces");

    const top = document.createElement("div");

    top.innerHTML = `
        <label>Default Network Interface</label>
    `;

    const addButton = Button({
        text: "Clear"
    });

    top.append(addButton);

    container.append(top);

    return container;
}
