import {
    PEER_CONNECTION_STATE,
    PeerConnectionPairing
} from "../../../src/connectivity/types";
import api from "../../api";
import { INCOMING_PEER_CONNECTION_REQUEST_DIALOG } from "../../constants";
import "./index.css";
import rpc from "../../rpc";

export class Peers {
    backAction: () => void;

    peersLists: HTMLDivElement = document.createElement("div");

    constructor() {
        const renderPeersListsIfVisible = () => {
            if (document.body.contains(this.peersLists)) {
                this.renderPeersLists();
            }
        };

        onPush["peerConnectivityEvent"] = renderPeersListsIfVisible;
    }

    static peerConnectionRequestPairingDialog(
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
        trustButton.classList.add("text");
        buttonGroup.append(trustButton);
        trustButton.innerText = "Trust";

        inner.append(buttonGroup);

        dialog.append(inner);
        document.body.append(dialog);

        return new Promise((resolve) => {
            dontTrustButton.addEventListener("click", () => {
                resolve(false);
                dialog.remove();
            });
            trustButton.addEventListener("click", () => {
                resolve(true);
                dialog.remove();
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
                !peersConnections.find(({ peer }) => peer.id === peerTrusted.id)
        );
        peersNearby = peersNearby.filter(
            (peerNeerby) =>
                !peersConnections.find(
                    ({ peer }) => peer.id === peerNeerby.peer.id
                )
        );

        const peerConnectionTitle = document.createElement("h3");
        peerConnectionTitle.innerText = `Connected (${peersConnections.length})`;
        const peerConnectionList = document.createElement("ul");
        peersConnections.forEach((peerConnection) => {
            const li = document.createElement("li");
            li.innerText = peerConnection.peer.name;

            const div = document.createElement("div");
            switch (peerConnection.state) {
                case PEER_CONNECTION_STATE.PAIRING:
                    div.innerHTML = `Pairing... Code: <b>${(peerConnection as PeerConnectionPairing).validation}</b>`;
                    break;
                case PEER_CONNECTION_STATE.UNTRUSTED:
                    div.innerHTML = `Connecting...`;
                    break;
                case PEER_CONNECTION_STATE.CONNECTED:
                    const disconnectButton = document.createElement("button");
                    disconnectButton.classList.add("danger");
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

    async render() {
        const container = document.createElement("div");
        container.classList.add("peers");

        const header = document.createElement("header");

        const left = document.createElement("div");

        const backButton = document.createElement("button");
        backButton.innerHTML = await (
            await fetch("/assets/icons/chevron.svg")
        ).text();
        backButton.classList.add("text");
        backButton.addEventListener("click", this.backAction);
        left.append(backButton);

        const title = document.createElement("h1");
        title.innerText = "Peers";
        left.append(title);

        header.append(left);

        container.append(header);

        container.append(this.peersLists);
        this.renderPeersLists();

        api.connectivity.advertise(30 * 1000); // 30s
        rpc().connectivity.browse.start();

        return container;
    }
}
