import api from "..";
import { Browser } from "../../../src/connectivity/browser";
import {
    PEER_ADVERSTISING_METHOD,
    Peer,
    PeerNearby,
    PeerNearbyWeb,
    WebAddress
} from "../../../src/connectivity/types";
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

    return (
        (protocol ? protocol + "://" : "") +
        hostname +
        (address.port ? ":" + address.port : "")
    );
};

export class BrowseWeb implements Browser {
    peerNearbyWeb: PeerNearbyWeb[] = [];

    onPeerNearby: (eventType: "new" | "lost", peerNearby: PeerNearby) => void;

    getPeersNearby() {
        return this.peerNearbyWeb;
    }

    private async browse() {
        const addresses = (await api.config.load(CONFIG_TYPE.CONNECTIVITY))
            .webAddreses;

        if (!addresses) return;

        addresses.forEach(async address => {
            const url = constructURL(address, "http");

            const promise = new Promise<Peer>((resolve) => {
                rpc()
                    .fetch(url, { 
                        encoding: "utf8",
                        timeout: 2000
                     })
                    .then((response) => {
                        let peer: Peer = null;
                        try {
                            peer = JSON.parse(response.body as string);
                        } catch (e) {}

                        if (
                            typeof peer.id === "string" &&
                            typeof peer.name === "string"
                        ) {
                            resolve(peer);
                        } else {
                            resolve(null);
                        }
                    })
                    .catch(() => resolve(null));
            });

            const peer = await promise;

            if (peer) {
                const indexOf = this.peerNearbyWeb.findIndex(
                    ({ address }) => constructURL(address, "http") === url
                );
                if (indexOf !== -1) {
                    this.peerNearbyWeb[indexOf].peer = peer;
                } else {
                    const peerNearbyWeb: PeerNearbyWeb = {
                        peer,
                        address,
                        type: PEER_ADVERSTISING_METHOD.WEB
                    };
                    this.peerNearbyWeb.push(peerNearbyWeb);
                    this.onPeerNearby?.("new", peerNearbyWeb);
                }
            } 
            else {
                const indexOf = this.peerNearbyWeb.findIndex(
                    ({ address: { hostname, port } }) =>
                        hostname + (port ? ":" + port : "") === url.toString()
                );
                if (indexOf !== -1) {
                    const peerLost = this.peerNearbyWeb
                        .splice(indexOf, 1)
                        .at(0);
                    this.onPeerNearby?.("lost", peerLost);
                }
            }
        });
    }

    browseInterval: ReturnType<typeof setInterval>;
    async startBrowsing() {
        this.stopBrowsing();

        this.browse();
        this.browseInterval = setInterval(this.browse.bind(this), 1000 * 60); // 1min
    }
    stopBrowsing(): void {
        if (this.browseInterval) {
            clearInterval(this.browseInterval);
            this.browseInterval = null;
        }
    }

    peerNearbyIsDead(id: string): void {
        const indexOf = this.peerNearbyWeb.findIndex(({peer}) => peer.id === id);
        if(indexOf === -1) return;
        this.onPeerNearby?.("lost", this.peerNearbyWeb.splice(indexOf, 1).at(0));
    }
}
