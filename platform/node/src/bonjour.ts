import { Bonjour as BonjourService, Service } from 'bonjour-service';
import { WebSocket, WebSocketServer } from "ws";
import os from "os";
import child_process from "child_process"
import { PEER_ADVERSTISING_METHOD, PEER_CONNECTION_STATE, PEER_CONNECTION_TYPE, Peer, PeerConnection, PeerNearbyBonjour } from '../../../src/adapter/connectivity';

export class Bonjour {
    bonjour = new BonjourService();
    port = randomIntFromInterval(10000, 60000);
    wss = new WebSocketServer({ port: this.port });
    advertiser: ReturnType<BonjourService["publish"]>;

    peersNearby: Map<string, PeerNearbyBonjour> = new Map();

    onMessage: (data: string) => void;
    onPeerNearby: (eventType: "new" | "lost") => void;
    onPeerConnectionRequest: (peerConnectionRequest: string, id: number) => void;
    onPeerConnection: (eventType: "connected" | "disconnected") => void;

    peers = new Map<WebSocket, PeerConnection>();

    constructor(){
        this.wss.on("connection", ws => {
            const id = randomIntFromInterval(100000, 999999);
            this.peers.set(ws, { 
                id,
                peer: null,
                state: PEER_CONNECTION_STATE.UNTRUSTED,
                type: PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER
            });

            ws.on("close", () => {
                this.peers.delete(ws);
                if(this.onPeerConnection) {
                    this.onPeerConnection("disconnected");
                }
            });

            ws.onmessage = message => {
                if(message.type === "binary") {
                    console.log("Binary message on websocket is not yet supported")
                    return;
                }
                const data: string = message.data as string;

                const { peer } = this.peers.get(ws);
                if(peer === null) {
                    try {
                        if(this.onPeerConnectionRequest)
                            this.onPeerConnectionRequest(data, id);
                    } catch(e) {
                        console.log("Unable to parse Peer Connection Request");
                        return;
                    }
                } else {
                    //
                }
            };
            
        });

        const cleanup = () => {
            this.bonjour.unpublishAll(() => process.exit(0))
        }
        
        process.on('exit', cleanup.bind(this));
        process.on('SIGINT', cleanup.bind(this));
        process.on('SIGUSR1', cleanup.bind(this));
        process.on('SIGUSR2', cleanup.bind(this));
        process.on('uncaughtException', cleanup.bind(this));

        const browser = this.bonjour.find({ type: 'fullstacked' }, service => {
            if(service.port === this.port) return;

            this.peersNearby.set(service.name, {
                type: PEER_ADVERSTISING_METHOD.BONJOUR,
                peer: {
                    id: service.name,
                    name: service.txt._d,
                },
                port: service.port,
                addresses: service.addresses || []
            });

            if(this.onPeerNearby) {
                this.onPeerNearby("new");
            }
        });

        browser.on("down", (service: Service) => {
            this.peersNearby.delete(service.name);

            if(this.onPeerNearby) {
                this.onPeerNearby("lost");
            }
        });
    }

    info() {
        const networkInterfaces = os.networkInterfaces();
        const interfaces = ["en", "wlan", "WiFi", "Ethernet", "wlp"];

        return {
            port: this.port,
            interfaces: Object.entries(networkInterfaces)
                .filter(([netInterface, _]) => interfaces.find(prefix => netInterface.startsWith(prefix)))
                .map(([netInterface, infos]) => ({
                    name: netInterface,
                    addresses: infos?.map(({address}) => address) ?? []
                }))
        }
    }

    advertise(id: Peer["id"]){
        if(this.advertiser)
            this.advertiser.stop();
        
        const info = this.info();

        this.advertiser = this.bonjour.publish({ 
            name: id, 
            type: 'fullstacked', 
            port: this.port,
            host: os.hostname() + '-fullstacked',
            txt: {
                _d: getComputerName(),
                addresses: info.interfaces.map(({addresses}) => addresses).flat().join(","),
                port: this.port
            }
        });
    }

    advertiseEnd() {
        this.bonjour.unpublishAll();
    }

    disconnect(peerConnection: PeerConnection){
        for(const [ws, { id }] of this.peers) {
            if(id === peerConnection.id) {
                ws.close();
                return;
            }
        }
    }

    // async pair(nearbyPeer: NearbyPeer){
    //     let paired = false;
    //     for(const address of nearbyPeer.addresses) {
    //         if(paired) break;
    //         try {
    //             await new Promise<void>(resolve => {
    //                 const url = "ws://" + 
    //                     (address.includes(":") ? `[${address}]` : address) + 
    //                     (nearbyPeer.port ?  ":" + nearbyPeer.port : "");
    //                 console.log("Trying to pair to " + url);
    //                 const peerWS = new WebSocket(url);
    //                 setTimeout(resolve, 3000);
    //                 peerWS.onopen = () => {
    //                     console.log("Connected with a peer");
    //                     const peer = { name: nearbyPeer.name, id: nearbyPeer.id };
    //                     Bonjour.peers.set(peerWS, peer);
    //                     paired = true;
    //                     if(this.onConnectedPeer)
    //                         this.onConnectedPeer(peer)
    //                     peerWS.send(JSON.stringify({
    //                         name: getComputerName(),
    //                         id: this.id
    //                     }))
    //                     resolve();
    //                 };
    //                 peerWS.onmessage = ({data}) => {
    //                     if(this.onMessage) this.onMessage(data as string)
    //                 };
    //             });
    //         } catch (e) { console.log(e) }
    //     }
    //     return paired;
    // }

    // static broadcast(data: any){
    //     for(const [ws, peer] of Bonjour.peers.entries()) {
    //         if(peer) ws.send(data)
    //     }
    // }
}


function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
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

// remove all mDNS entries on macOS
// sudo killall -HUP mDNSResponder