import child_process from "child_process";
import os from "os";
import {
    Bonjour as BonjourService,
    Browser as BonjourBrowser,
    Service
} from "bonjour-service";
import { Advertiser } from "../../../../src/connectivity/advertiser";
import { Browser } from "../../../../src/connectivity/browser";
import { WebSocketServer } from "./websocketServer";
import {
    PeerNearby,
    PEER_ADVERSTISING_METHOD,
    Peer,
    PeerNearbyBonjour
} from "../../../../src/connectivity/types";

export class Bonjour implements Advertiser, Browser {
    onPeerNearby: (eventType: "new" | "lost", peerNearby: PeerNearby) => void;

    peersNearby: Map<string, PeerNearby> = new Map();
    bonjour = new BonjourService();

    advertiser: Service;
    browser: BonjourBrowser;

    networkInterface: string;

    wsServer: WebSocketServer;
    constructor(wsServer: WebSocketServer, defaultNetworkInterface?: string) {
        this.wsServer = wsServer;

        const cleanOnExit = () => {
            this.cleanup().then(() => process.exit(0));
        };

        process.on("exit", cleanOnExit.bind(this));
        process.on("SIGINT", cleanOnExit.bind(this));
        process.on("SIGUSR1", cleanOnExit.bind(this));
        process.on("SIGUSR2", cleanOnExit.bind(this));
        process.on("uncaughtException", cleanOnExit.bind(this));
    }

    cleanup() {
        return new Promise((res) => {
            this.bonjour.unpublishAll(res);
        });
    }

    getPeersNearby(): PeerNearby[] {
        return Array.from(this.peersNearby.values());
    }

    startBrowsing(): void {
        this.browser?.stop();

        this.browser = this.bonjour.find({ type: "fullstacked" }, (service) => {
            if (service.port === this.wsServer.port) return;

            const peerNearby: PeerNearbyBonjour = {
                type: PEER_ADVERSTISING_METHOD.BONJOUR,
                peer: {
                    id: service.name,
                    name: service.txt._d
                },
                port: service.port,
                addresses: service.addresses || []
            };

            this.peersNearby.set(peerNearby.peer.id, peerNearby);

            this.onPeerNearby?.("new", peerNearby);
        });

        this.browser.on("down", (service: Service) => {
            const id = service.name;
            this.peersNearby.delete(id);
            this.onPeerNearby?.("lost", {
                id: null,
                type: null,
                peer: {
                    id,
                    name: service.txt._d
                }
            });
        });
    }
    stopBrowsing(): void {
        this.browser?.stop();
    }

    async startAdvertising(me: Peer, networkInterface?: string) {
        this.advertiser?.stop();

        if (networkInterface !== this.networkInterface) {
            this.networkInterface = networkInterface;

            const inet = getNetworkInterfacesInfo(true).find(
                ({ name }) => name === networkInterface
            );
            if (inet?.addresses.length > 0) {
                await this.cleanup();
                this.bonjour = new BonjourService({
                    // @ts-ignore
                    interface: inet.addresses.at(0)
                });
            }
        }

        const info = getNetworkInterfacesInfo();

        this.advertiser = this.bonjour.publish({
            name: me.id,
            type: "fullstacked",
            port: this.wsServer.port,
            host: os.hostname() + "-fullstacked",
            txt: {
                _d: me.name,
                addresses: info
                    .map(({ addresses }) => addresses)
                    .flat()
                    .join(","),
                port: this.wsServer.port
            }
        });
    }

    stopAdvertising(): void {
        this.bonjour.unpublishAll();
    }
}

export function getNetworkInterfacesInfo(ipv4Only = false) {
    const networkInterfaces = os.networkInterfaces();

    const interfaces = ["en", "wlan", "WiFi", "Wi-Fi", "Ethernet", "wlp"];

    return Object.entries(networkInterfaces)
        .filter(([netInterface, _]) =>
            interfaces.find((prefix) => netInterface.startsWith(prefix))
        )
        .map(([netInterface, infos]) => ({
            name: netInterface,
            addresses:
                infos
                    ?.filter((iface) =>
                        ipv4Only ? iface.family === "IPv4" : true
                    )
                    .map(({ address }) => address) ?? []
        }));
}

export function getComputerName() {
    switch (process.platform) {
        case "win32":
            return process.env.COMPUTERNAME;
        case "darwin":
            return child_process
                .execSync("scutil --get ComputerName")
                .toString()
                .trim();
        default:
            return os.hostname();
    }
}
