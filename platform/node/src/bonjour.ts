import { Bonjour as BonjourService } from 'bonjour-service';
import { WebSocket, WebSocketServer } from "ws";
import { randomUUID } from 'crypto';
import os from "os";
import child_process from "child_process"

export type Peer = {
    id: string,
    name: string
}

export type NearbyPeer = Peer & {
    port: number,
    addresses: string[]
}

export class Bonjour {
    id = randomUUID();
    bonjour = new BonjourService();
    port = randomIntFromInterval(10000, 60000);
    wss = new WebSocketServer({ port: this.port });
    advertiser: ReturnType<BonjourService["publish"]>;

    onMessage: (data: string) => void;
    onNearbyPeer: (nearbyPeer: NearbyPeer) => void;
    onConnectedPeer: (peer: Peer) => void;

    static peers = new Map<WebSocket, (Peer | null)>();

    constructor(){
        this.wss.on("connection", ws => {
            console.log("Connected with new peer")
            Bonjour.peers.set(ws, null);
            ws.onmessage = ({ data }) => {
                const peer = Bonjour.peers.get(ws);
                if(!peer) {
                    const peer = JSON.parse(data as string);
                    Bonjour.peers.set(ws, peer);
                    if(this.onConnectedPeer) this.onConnectedPeer(peer);
                } else if (this.onMessage) {
                    this.onMessage(data as string);
                }
            };
            ws.on("close", () => Bonjour.peers.delete(ws));
        });

        const cleanup = () => {
            this.bonjour.unpublishAll(() => process.exit(0))
        }
        
        process.on('exit', cleanup.bind(this));
        process.on('SIGINT', cleanup.bind(this));
        process.on('SIGUSR1', cleanup.bind(this));
        process.on('SIGUSR2', cleanup.bind(this));
        process.on('uncaughtException', cleanup.bind(this));
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

    advertise(){
        if(this.advertiser)
            this.advertiser.stop();
        
        const info = this.info();

        this.advertiser = this.bonjour.publish({ 
            name: this.id, 
            type: 'fullstacked', 
            port: this.port,
            txt: {
                _d:  getComputerName(),
                addresses: info.interfaces.map(({addresses}) => addresses).flat().join(","),
                port: this.port
            }
        });

        setTimeout(() => this.advertiser?.stop(), 30000);
    }

    browse(){
        this.bonjour.find({ type: 'fullstacked' }, service => {
            if(service.port === this.port) return;

            if(this.onNearbyPeer) {
                this.onNearbyPeer({
                    id: service.name,
                    name: service.txt._d,
                    port: service.port,
                    addresses: service.addresses || []
                })
            }
        });
    }

    async pair(nearbyPeer: NearbyPeer){
        let paired = false;
        for(const address of nearbyPeer.addresses) {
            if(paired) break;
            try {
                await new Promise<void>(resolve => {
                    const url = "ws://" + 
                        (address.includes(":") ? `[${address}]` : address) + 
                        (nearbyPeer.port ?  ":" + nearbyPeer.port : "");
                    console.log("Trying to pair to " + url);
                    const peerWS = new WebSocket(url);
                    setTimeout(resolve, 3000);
                    peerWS.onopen = () => {
                        console.log("Connected with a peer");
                        const peer = { name: nearbyPeer.name, id: nearbyPeer.id };
                        Bonjour.peers.set(peerWS, peer);
                        paired = true;
                        if(this.onConnectedPeer)
                            this.onConnectedPeer(peer)
                        peerWS.send(JSON.stringify({
                            name: getComputerName(),
                            id: this.id
                        }))
                        resolve();
                    };
                    peerWS.onmessage = ({data}) => {
                        if(this.onMessage) this.onMessage(data as string)
                    };
                });
            } catch (e) { console.log(e) }
        }
        return paired;
    }

    static broadcast(data: any){
        for(const [ws, peer] of Bonjour.peers.entries()) {
            if(peer) ws.send(data)
        }
    }
}


function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function getComputerName() {
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