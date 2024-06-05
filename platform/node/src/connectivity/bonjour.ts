import child_process from "child_process";
import os from "os";
import { Bonjour as BonjourService, Browser as BonjourBrowser, Service } from 'bonjour-service';
import { Advertiser } from "../../../../src/connectivity/advertiser";
import { Browser } from "../../../../src/connectivity/browser";
import { WebSocketServer } from "./websocketServer";
import { PeerNearby, PEER_ADVERSTISING_METHOD, Peer } from "../../../../src/connectivity/types";

export class Bonjour implements Advertiser, Browser {
    onPeerNearby: (eventType: "new" | "lost") => void;

    peersNearby: Map<string, PeerNearby> = new Map();
    bonjour = new BonjourService();

    advertiser: Service;
    browser: BonjourBrowser;

    wsServer: WebSocketServer;
    constructor(wsServer: WebSocketServer) {
        this.wsServer = wsServer;

        const cleanup = () => {
            this.bonjour.unpublishAll(() => process.exit(0))
        }

        process.on('exit', cleanup.bind(this));
        process.on('SIGINT', cleanup.bind(this));
        process.on('SIGUSR1', cleanup.bind(this));
        process.on('SIGUSR2', cleanup.bind(this));
        process.on('uncaughtException', cleanup.bind(this));
    }

    getPeersNearby(): PeerNearby[] {
        return Array.from(this.peersNearby.values())
    }
    
    startBrowsing(): void {
        this.browser = this.bonjour.find({ type: 'fullstacked' }, service => {
            if (service.port === this.wsServer.port) return;

            const peerNearby: PeerNearby = {
                type: PEER_ADVERSTISING_METHOD.BONJOUR,
                peer: {
                    id: service.name,
                    name: service.txt._d
                },
                port: service.port,
                addresses: service.addresses || []
            }

            this.peersNearby.set(peerNearby.peer.id, peerNearby);

            this.onPeerNearby?.("new");
        });

        this.browser.on("down", (service: Service) => {
            const id = service.name;
            this.peersNearby.delete(id);
            this.onPeerNearby?.("lost");
        });
    }
    stopBrowsing(): void {
        this.browser?.stop()
    }

    startAdvertising(me: Peer): void {
        this.advertiser?.stop();

        const info = getNetworkInterfacesInfo();

        this.advertiser = this.bonjour.publish({
            name: me.id,
            type: 'fullstacked',
            port: this.wsServer.port,
            host: os.hostname() + '-fullstacked',
            txt: {
                _d: me.name,
                addresses: info.map(({ addresses }) => addresses).flat().join(","),
                port: this.wsServer.port
            }
        });
    }

    stopAdvertising(): void {
        this.bonjour.unpublishAll();
    }

}

function getNetworkInterfacesInfo(){
    const networkInterfaces = os.networkInterfaces();

    const interfaces = ["en", "wlan", "WiFi", "Wi-Fi", "Ethernet", "wlp"];

    return Object.entries(networkInterfaces)
        .filter(([netInterface, _]) => interfaces.find(prefix => netInterface.startsWith(prefix)))
        .map(([netInterface, infos]) => ({
            name: netInterface,
            addresses: infos?.map(({ address }) => address) ?? []
        }))
}

export function getComputerName() {
    switch (process.platform) {
        case "win32":
            return process.env.COMPUTERNAME;
        case "darwin":
            return child_process.execSync("scutil --get ComputerName").toString().trim();
        default:
            return os.hostname();
    }
}