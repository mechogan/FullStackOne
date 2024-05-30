import { PEER_CONNECTION_STATE, PeerConnectionPairing } from "../../../src/adapter/connectivity";
import api from "../../api";
import "./index.css";

export class Peers {
    backAction: () => void;

    peersLists: HTMLDivElement = document.createElement("div");

    constructor() {
        onPush["peerNearby"] = () => {
            if(document.body.contains(this.peersLists)) {
                this.renderPeersLists();
            }
        }
    }

    async renderPeersLists() {
        let [
            peersConnections,
            peersTrusted,
            peersNearby
        ] = await Promise.all([
            api.connectivity.peers.connections(),
            api.connectivity.peers.trusted(),
            api.connectivity.peers.nearby()
        ])

        peersTrusted = peersTrusted
            .filter(peerTrusted => !peersConnections.find(({ id }) => id === peerTrusted.id));
        peersNearby = peersNearby
            .filter(peerNeerby => !peersConnections.find(({ id }) => id === peerNeerby.id));

        const peerConnectionTitle = document.createElement("h3");
        peerConnectionTitle.innerText = `Connected (${peersConnections.length})`;
        const peerConnectionList = document.createElement("ul");
        peersConnections.forEach(peerConnection => {
            const li = document.createElement("li");
            li.innerText = peerConnection.name;

            if(peerConnection.state === PEER_CONNECTION_STATE.PAIRING) {
                const div = document.createElement("div");
                div.innerHTML = `Pairing... Code: <b>${(peerConnection as PeerConnectionPairing).validation}</b>`;
                li.append(div);
            }

            peerConnectionList.append(li);
        })

        const peerNearbyTitle = document.createElement("h3");
        peerNearbyTitle.innerText = `Nearby (${peersNearby.length})`;
        const peerNearbyList = document.createElement("ul");
        peersNearby.forEach(peerNearby => {
            const li = document.createElement("li");
            li.innerText = peerNearby.name;

            const pairButton = document.createElement("button");
            pairButton.innerText = "Pair";
            li.append(pairButton);

            pairButton.addEventListener("click", async () => {
                const div = document.createElement("div");
                div.innerText = "Connecting...";
                pairButton.replaceWith(div);
                await api.connectivity.connect(peerNearby);
                this.renderPeersLists();
            });

            peerNearbyList.append(li);
        });

        const peerTrustedTitle = document.createElement("h3");
        peerTrustedTitle.innerText = `Trusted (${peersTrusted.length})`;
        const peerTrustedList = document.createElement("ul");
        peersTrusted.forEach(peerTrusted => {
            const li = document.createElement("li");
            li.innerText = peerTrusted.name;
            peerTrustedList.append(li);
        })

        this.peersLists.replaceChildren(
            peerConnectionTitle,
            peerConnectionList, 

            peerNearbyTitle,
            peerNearbyList, 

            peerTrustedTitle,
            peerTrustedList
        );
    }

    // async renderManualInputDialog(){
    //     const dialog = document.createElement("div");
    //     dialog.id = "manual-peer-pairing";
    //     dialog.classList.add("dialog");

    //     const container = document.createElement("div");

    //     container.innerHTML = `<h2>Pair Manually</h2>`;

    //     const infos = document.createElement("div");
    //     infos.classList.add("net-infos");
    //     container.append(infos);

    //     rpc().peers.info()
    //         .then(async netInfo => {
    //             if(!netInfo) return;

    //             const netInfosContainer = document.createElement("div");

    //             netInfosContainer.innerHTML = await (await fetch("assets/icons/info.svg")).text();

    //             const dl = document.createElement("dl");

    //             dl.innerHTML = `<dt>Port</dt>
    //             <dd>${netInfo.port}</dd>`;

    //             netInfo.interfaces.forEach(({name, addresses}) => {
    //                 dl.innerHTML += `<dt>${name}</dt>
    //                 <dd><ul>${addresses.map(address => `<li>${address}</li>`).join("")}</ul></dd>`;
    //             });

    //             netInfosContainer.append(dl)

    //             infos.append(netInfosContainer);
    //         });

    //     const p = document.createElement("p");
    //     p.innerText = "Pair with another peer manually";
    //     container.append(p);

    //     const inputPort = document.createElement("input");
    //     inputPort.placeholder = "Port";
    //     container.append(inputPort);

    //     const inputAddress = document.createElement("input");
    //     inputAddress.placeholder = "IP or Host";
    //     container.append(inputAddress);

    //     const buttonGroup = document.createElement("div");
    //     buttonGroup.classList.add("button-group");

    //     const [
    //         closeIcon,
    //         checkIcon
    //     ] = await Promise.all([
    //         (await fetch("assets/icons/close.svg")).text(),
    //         (await fetch("assets/icons/check.svg")).text(),
    //     ])

    //     const cancelButton = document.createElement("button");
    //     cancelButton.classList.add("text", "danger");
    //     cancelButton.innerHTML = closeIcon;
    //     cancelButton.addEventListener("click", () => dialog.remove());
    //     buttonGroup.append(cancelButton);

    //     const pairButton = document.createElement("button");
    //     pairButton.classList.add("text");
    //     pairButton.innerHTML = checkIcon;
    //     pairButton.addEventListener("click", async() => {
    //         pairButton.disabled = true;
    //         pairButton.innerText = "Pairing...";

    //         const peer = {
    //             addresses: [ inputAddress.value ],
    //             name: `Manual Input [${inputAddress.value.includes(":") ? `[${inputAddress.value}]` : inputAddress.value}:${inputPort.value}]`,
    //             port: parseInt(inputPort.value),
    //             id: null
    //         }

    //         await rpc().peers.pair(peer)
    //         dialog.remove();
    //     });
    //     buttonGroup.append(pairButton);

    //     container.append(buttonGroup)

    //     dialog.append(container);

    //     document.body.append(dialog);
    // }

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

        const manualPairingButton = document.createElement("button");
        manualPairingButton.innerHTML = await (
            await fetch("/assets/icons/connect.svg")
        ).text();
        manualPairingButton.classList.add("text");
        // manualPairingButton.addEventListener("click", () => this.renderManualInputDialog());
        header.append(manualPairingButton);

        container.append(header);

        container.append(this.peersLists);
        this.renderPeersLists();

        api.connectivity.advertise(30 * 1000) // 30s

        return container;
    }
}