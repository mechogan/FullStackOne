import {
    PEER_ADVERSTISING_METHOD,
    PEER_CONNECTION_STATE,
    PeerConnectionPairing
} from "../../../src/connectivity/types";
import api from "../../api";
import {
    INCOMING_PEER_CONNECTION_REQUEST_DIALOG,
    MANUAL_PEER_CONNECT_DIALOG,
    PEER_CONNECTIVITY_BACK_BUTTON_ID,
    PEER_DISCONNECT_BUTTON_CLASS,
    PEER_PAIRING_CODE_CLASS,
    PEER_PAIR_BUTTON_CLASS,
    PEER_TRUST_BUTTON_ID
} from "../../constants";
import "./index.css";
import rpc from "../../rpc";
import stackNavigation from "../../stack-navigation";

class Peers {
    peersLists: HTMLDivElement = document.createElement("div");

    constructor() {
        const renderPeersListsIfVisible = () => {
            if (document.body.contains(this.peersLists)) {
                this.renderPeersLists();
            }
        };

        onPush["peerConnectivityEvent"] = renderPeersListsIfVisible;
    }

    peerConnectionRequestPairingDialog(
        name: string,
        validation: number
    ): Promise<boolean> {
        const dialog = document.createElement("div");
        dialog.classList.add("dialog");

        const inner = document.createElement("div");
        inner.id = INCOMING_PEER_CONNECTION_REQUEST_DIALOG;

        inner.innerHTML = `<h2>Someone is trying to connect</h2>
        <p>
            <u>${name}</u> is trying to pair with you.
        </p>
        <p>
            Make sure you recognize this request and validate with the following code
        </p>
        <div class="code">
            <span>${validation}</span>
        </div>`;

        const buttonGroup = document.createElement("div");
        buttonGroup.classList.add("button-group");

        const dontTrustButton = document.createElement("button");
        dontTrustButton.classList.add("text", "danger");
        dontTrustButton.innerText = "Don't Trust";
        buttonGroup.append(dontTrustButton);

        const trustButton = document.createElement("button");
        trustButton.id = PEER_TRUST_BUTTON_ID;
        trustButton.classList.add("text");
        buttonGroup.append(trustButton);
        trustButton.innerText = "Trust";

        inner.append(buttonGroup);

        dialog.append(inner);
        document.body.append(dialog);
        stackNavigation.lock = true;

        return new Promise((resolve) => {
            dontTrustButton.addEventListener("click", () => {
                resolve(false);
                dialog.remove();
                stackNavigation.lock = false;
            });
            trustButton.addEventListener("click", () => {
                resolve(true);
                dialog.remove();
                stackNavigation.lock = false;
            });
        });
    }

    async renderPeersLists() {
        let [peersConnections, peersTrusted, peersNearby] = await Promise.all([
            api.connectivity.peers.connections(),
            api.connectivity.peers.trusted(),
            api.connectivity.peers.nearby()
        ]);

        peersTrusted = peersTrusted.filter(
            (peerTrusted) =>
                !peersConnections.find(({ peer }) => peer?.id === peerTrusted.id)
        );
        peersNearby = peersNearby.filter(
            (peerNeerby) =>
                !peersConnections.find(
                    ({ peer }) => peer?.id === peerNeerby.peer.id
                )
        );

        const peerConnectionTitle = document.createElement("h3");
        peerConnectionTitle.innerText = `Connected (${peersConnections.length})`;
        const peerConnectionList = document.createElement("ul");
        peersConnections.forEach((peerConnection) => {
            const li = document.createElement("li");
            li.innerText = peerConnection.peer?.name || "Connecting to peer...";

            const div = document.createElement("div");
            switch (peerConnection.state) {
                case PEER_CONNECTION_STATE.PAIRING:
                case PEER_CONNECTION_STATE.UNTRUSTED:
                    div.innerHTML = `Pairing... Validation: <b class="${PEER_PAIRING_CODE_CLASS}">${(peerConnection as PeerConnectionPairing).validation}</b>`;
                    break;
                case PEER_CONNECTION_STATE.NOT_CONNECTED:
                    div.innerHTML = `Connecting...`;
                    break;
                case PEER_CONNECTION_STATE.CONNECTED:
                    const disconnectButton = document.createElement("button");
                    disconnectButton.classList.add(
                        "danger",
                        PEER_DISCONNECT_BUTTON_CLASS
                    );
                    disconnectButton.innerText = "Disconnect";
                    disconnectButton.addEventListener("click", () =>
                        api.connectivity.disconnect(peerConnection)
                    );
                    div.append(disconnectButton);
                    break;
                default:
                    div.innerHTML = `<div class="loader"></div>`;
            }
            li.append(div);

            peerConnectionList.append(li);
        });

        const peerNearbyTitle = document.createElement("h3");
        peerNearbyTitle.innerText = `Nearby (${peersNearby.length})`;
        const peerNearbyList = document.createElement("ul");
        peersNearby.forEach((peerNearby) => {
            const li = document.createElement("li");
            li.innerText = peerNearby.peer.name;

            const pairButton = document.createElement("button");
            pairButton.classList.add(PEER_PAIR_BUTTON_CLASS);
            pairButton.innerText = "Pair";
            li.append(pairButton);

            pairButton.addEventListener("click", async () => {
                const div = document.createElement("div");
                div.innerText = "Connecting...";
                pairButton.replaceWith(div);
                api.connectivity.connect(peerNearby);
                this.renderPeersLists();
            });

            peerNearbyList.append(li);
        });

        const peerTrustedTitle = document.createElement("h3");
        peerTrustedTitle.innerText = `Trusted (${peersTrusted.length})`;
        const peerTrustedList = document.createElement("ul");
        peersTrusted.forEach((peerTrusted) => {
            const li = document.createElement("li");
            li.innerText = peerTrusted.name;

            const forgetButton = document.createElement("button");
            forgetButton.classList.add("danger");
            forgetButton.innerText = "Forget";
            li.append(forgetButton);

            forgetButton.addEventListener("click", async () => {
                forgetButton.disabled = true;
                await api.connectivity.forget(peerTrusted);
                this.renderPeersLists();
            });

            peerTrustedList.append(li);
        });

        this.peersLists.replaceChildren(
            peerConnectionTitle,
            peerConnectionList,

            peerNearbyTitle,
            peerNearbyList,

            peerTrustedTitle,
            peerTrustedList
        );
    }

    async renderManualConnectDialog() {
        const dialog = document.createElement("div");
        dialog.classList.add("dialog");
        dialog.id = MANUAL_PEER_CONNECT_DIALOG;

        const inner = document.createElement("div");
        dialog.append(inner);

        const title = document.createElement("h2");
        title.innerText = "Connect Manually";
        inner.append(title);

        const infos = await rpc().connectivity.infos();
        if (infos?.port && infos?.networkInterfaces?.length > 0) {
            const inet = document.createElement("div");
            inet.classList.add("inet-infos");

            const infoIcon = document.createElement("div");
            infoIcon.innerHTML = await (
                await fetch("assets/icons/info.svg")
            ).text();
            inet.append(infoIcon);

            inet.innerHTML += `
                <dl>
                    <dt>Port</dt>
                    <dd>${infos.port}</dd>
                    ${infos.networkInterfaces
                        .map(
                            ({ name, addresses }) => `
                        <dt>${name}</dt>
                        <dd>
                            <ul>
                                ${addresses.map((addr) => `<li>${addr}</li>`).join("")}
                            </ul>
                        </dd>
                    `
                        )
                        .join("")}
                </dl>
            `;

            inner.append(inet);
        }

        const [check, close] = await Promise.all([
            (await fetch("assets/icons/check.svg")).text(),
            (await fetch("assets/icons/close.svg")).text()
        ]);

        const form = document.createElement("form");

        const portLabel = document.createElement("label");
        portLabel.innerText = "Port";
        form.append(portLabel);

        const portInput = document.createElement("input");
        portInput.type = "tel";
        form.append(portInput);

        const addressLabel = document.createElement("label");
        addressLabel.innerText = "Address";
        form.append(addressLabel);

        const addressInput = document.createElement("input");
        form.append(addressInput);

        const buttonGroup = document.createElement("div");
        buttonGroup.classList.add("button-group");

        const confirmButton = document.createElement("button");
        confirmButton.classList.add("text");
        confirmButton.innerHTML = check;
        buttonGroup.append(confirmButton);

        const cancelButton = document.createElement("button");
        cancelButton.classList.add("text", "danger");
        cancelButton.innerHTML = close;
        buttonGroup.append(cancelButton);

        cancelButton.addEventListener("click", () => {
            dialog.remove();
            stackNavigation.lock = false;
        });

        form.append(buttonGroup);

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const address = addressInput.value;
            const port = portInput.value;

            api.connectivity.connect({
                peer: {
                    id: null,
                    name: `Manual Peer Connection [${address.includes(":") ? `[${address}]` : address}:${port}]`
                },
                type: PEER_ADVERSTISING_METHOD.BONJOUR,
                addresses: [address],
                port: parseInt(port)
            });

            dialog.remove();
            stackNavigation.lock = false;
        });

        inner.append(form);

        document.body.append(dialog);
        stackNavigation.lock = true;
    }

    async render() {
        const container = document.createElement("div");
        container.classList.add("peers");

        const header = document.createElement("header");

        const left = document.createElement("div");

        const backButton = document.createElement("button");
        backButton.id = PEER_CONNECTIVITY_BACK_BUTTON_ID;
        backButton.innerHTML = await (
            await fetch("/assets/icons/chevron.svg")
        ).text();
        backButton.classList.add("text");
        backButton.addEventListener("click", () => {
            stackNavigation.back();
        });
        left.append(backButton);

        const title = document.createElement("h1");
        title.innerText = "Peers";
        left.append(title);

        header.append(left);

        const manualConnectBtn = document.createElement("button");
        manualConnectBtn.classList.add("text");
        manualConnectBtn.innerHTML = await (
            await fetch("assets/icons/connect.svg")
        ).text();
        manualConnectBtn.addEventListener("click", () => {
            this.renderManualConnectDialog();
        });
        header.append(manualConnectBtn);

        container.append(header);

        container.append(this.peersLists);
        this.renderPeersLists();

        api.connectivity.advertise.start(30 * 1000); // 30s
        api.connectivity.browse.start();

        return container;
    }
}

export default new Peers();
