import api from "..";
import { Browser } from "../../../src/connectivity/browser";
import { PEER_ADVERSTISING_METHOD, PeerNearby, PeerNearbyWeb, WebAddress } from "../../../src/connectivity/types";
import { CONFIG_TYPE } from "../config/types";


export const constructURL = (
    address: WebAddress,
    protocol: "ws" | "http" | ""
) => {
    protocol += protocol && address.secure ? "s" : "";
    
    // check for ipv6
    const hostname = address.hostname?.includes(":") 
        ? `[${address.hostname}]` 
        : address.hostname;

    return (protocol ? protocol + "://" : "") + 
        hostname + 
        (address.port ? ":" + address.port : "");
}


export class BrowseWeb implements Browser {
    peerNearbyWeb: PeerNearbyWeb[] = [];

    onPeerNearby: (eventType: "new" | "lost", peerNearby: PeerNearby) => void;

    getPeersNearby() {
        return this.peerNearbyWeb;
    }

    private async browse(){
        const addresses = (await api.config.load(CONFIG_TYPE.CONNECTIVITY)).webAddreses;
        
        console.log(addresses);

        if(!addresses) return;

        for(const address of addresses) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000 * 3); // 3sec

            const url = constructURL(address, "http");

            console.log(url);
            
            try {

                const peer = await (await fetch(url, {
                    signal: controller.signal
                })).json();

                const indexOf = this.peerNearbyWeb.findIndex(({ address }) => 
                    constructURL(address, "http") === url);
                if(indexOf !== -1) {
                    this.peerNearbyWeb[indexOf].peer = peer;
                } else {
                    this.peerNearbyWeb.push({
                        peer,
                        address,
                        type: PEER_ADVERSTISING_METHOD.WEB
                    });
                }

                console.log(peer);

                this.onPeerNearby?.("new", peer);
            } 
            catch(e) {
                const indexOf = this.peerNearbyWeb.findIndex(({ address: { hostname, port } }) => 
                    hostname + (port ? ":" + port : "") === url.toString());
                if(indexOf !== 1) {
                    const peerLost = this.peerNearbyWeb.splice(indexOf, 1).at(0);
                    this.onPeerNearby?.("lost", peerLost);
                }
            }
            finally { clearTimeout(timeoutId) }
        }
    }

    browseInterval: ReturnType<typeof setInterval>;
    async startBrowsing() {
        this.stopBrowsing();

        this.browse();
        this.browseInterval = setInterval(this.browse.bind(this), 1000 * 60) // 1min
    }
    stopBrowsing(): void {
        if(this.browseInterval){
            clearInterval(this.browseInterval);
            this.browseInterval = null;
        }
    }
}