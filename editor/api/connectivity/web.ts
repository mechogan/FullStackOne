import api from "..";
import { Browser } from "../../../src/connectivity/browser";
import { PEER_ADVERSTISING_METHOD, PeerNearby, PeerNearbyWeb } from "../../../src/connectivity/types";
import { CONFIG_TYPE } from "../config/types";

export class BrowseWeb implements Browser {
    peerNearbyWeb: PeerNearbyWeb[] = [];

    onPeerNearby: (eventType: "new" | "lost", peerNearby: PeerNearby) => void;

    getPeersNearby() {
        return this.peerNearbyWeb;
    }

    async startBrowsing() {
        const addresses = (await api.config.load(CONFIG_TYPE.CONNECTIVITY)).webAddreses;
        
        if(!addresses) return;

        for(const webAddress of addresses) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000 * 5); // 5sec

            try {
                const peer = await (await fetch(webAddress.address, {
                    signal: controller.signal
                })).json();

                const indexOf = this.peerNearbyWeb.findIndex(({address}) => address === webAddress.address);
                if(indexOf !== -1) {

                } else {
                    this.peerNearbyWeb.push({
                        peer,
                        address: webAddress.address,
                        type: PEER_ADVERSTISING_METHOD.WEB
                    });
                }

                this.onPeerNearby?.("new", peer);
            } 
            catch(e) {
                const indexOf = this.peerNearbyWeb.findIndex(({address}) => address === webAddress.address);
                if(indexOf !== 1) {
                    const peerLost = this.peerNearbyWeb.splice(indexOf, 1).at(0);
                    this.onPeerNearby?.("lost", peerLost);
                }
            }
            finally { clearTimeout(timeoutId) }
        }
    }
    stopBrowsing(): void {
        throw new Error("Method not implemented.");
    }
}