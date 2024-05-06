import type { Peer } from "../../../platform/node/src/multipeer";
import rpc from "../../rpc";
import "./index.css";

export class Peers {
    backAction: () => void;

    peersList = document.createElement("div");
    nearbyPeers: Peer[] = [];

    constructor(){
        (window as any).onPush["nearbyPeer"] = async (message: string) => {
            this.nearbyPeers.push(JSON.parse(message));
            this.renderNearbyPeers();
        }
    }
    
    renderNearbyPeers(){
        const ul = document.createElement("ul");

        this.nearbyPeers.forEach(peer => {
            const li = document.createElement("li");

            li.innerHTML = peer.name;
            
            const pairBtn = document.createElement("button");
            pairBtn.innerText = "Pair";

            pairBtn.addEventListener("click", async () => {
                pairBtn.innerText = "Paring...";
                pairBtn.disabled = true;
                const paired = await rpc().peers.pair(peer);

                if(paired) {
                    const bold = document.createElement("b");
                    bold.innerText = "Paired";
                    pairBtn.replaceWith(bold);
                }
            })

            li.append(pairBtn);
            ul.append(li);
        });

        Array.from(this.peersList.children).forEach(e => e.remove());
        this.peersList.append(ul);
    }

    async render() {
        const container = document.createElement("div");
        container.classList.add("peers");

        const header = document.createElement("header");

        const backButton = document.createElement("button");
        backButton.innerHTML = await (
            await fetch("/assets/icons/chevron.svg")
        ).text();
        backButton.classList.add("text");
        backButton.addEventListener("click", this.backAction);
        header.append(backButton);

        const title = document.createElement("h1");
        title.innerText = "Peers";
        header.append(title);

        container.append(header);

        container.append(this.peersList);

        rpc().peers.advertise();
        rpc().peers.browse();

        return container;
    }
}