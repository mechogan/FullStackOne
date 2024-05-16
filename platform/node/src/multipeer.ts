import { Bonjour } from 'bonjour-service';
import { WebSocket, WebSocketServer } from "ws";
import { randomUUID } from 'crypto';
import os from "os";
import child_process from "child_process"

type Peer = {
    name: string
}

export type NearbyPeer = Peer & {
    port: number,
    addresses: string[]
}

export class Multipeer {
    bonjour = new Bonjour();
    port = randomIntFromInterval(10000, 60000);
    wss = new WebSocketServer({ port: this.port });
    onMessage: (data: any) => void;

    static peers = new Map<WebSocket, (Peer | null)>();

    constructor(onMessage: (data: any) => void){
        this.onMessage = onMessage;

        this.wss.on("connection", ws => {
            console.log("Connected with new peer")
            Multipeer.peers.set(ws, null);
            ws.onmessage = ({ data }) => {
                const peer = Multipeer.peers.get(ws);
                if(!peer) {

                } else {
                    this.onMessage(data)
                }
            };
            ws.on("close", () => Multipeer.peers.delete(ws));
        });
    }

    info() {
        const networkInterfaces = os.networkInterfaces();
        const interfaces = ["en", "wlan", "WiFi", "Ethernet"];

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
        const info = this.info();

        const peerId = randomUUID();
        const advertiser = this.bonjour.publish({ 
            name: peerId, 
            type: 'fullstacked', 
            port: this.port,
            txt: {
                _d:  getComputerName(),
                addresses: info.interfaces.map(({addresses}) => addresses).flat().join(","),
                port: this.port
            }
        });

        setTimeout(() => { if(advertiser?.stop) advertiser.stop() }, 30000);
    }

    browse(onService: (peer: NearbyPeer) => void){
        this.bonjour.find({ type: 'fullstacked' }, service => {
            if(service.port === this.port) return;

            onService({
                ...service,
                addresses: service.addresses || []
            });
        });
    }

    async pair(peer: NearbyPeer){
        let paired = false;
        for(const address of peer.addresses) {
            if(paired) break;
            try {
                await new Promise<void>(resolve => {
                    const url = "ws://" + 
                        (address.includes(":") ? `[${address}]` : address) + 
                        (peer.port ?  ":" + peer.port : "");
                    console.log("Trying to pair to " + url);
                    const peerWS = new WebSocket(url);
                    setTimeout(resolve, 3000);
                    peerWS.onopen = () => {
                        console.log("Connected with a peer")
                        Multipeer.peers.add(peerWS);
                        paired = true;
                        resolve();
                    };
                    peerWS.onmessage = ({data}) => this.onMessage(data);
                });
            } catch (e) { }
        }
        return paired;
    }

    static broadcast(data: any){
        for(const [ws, peer] of Multipeer.peers.entries()) {
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
    case "linux":
      const prettyname = child_process.execSync("hostnamectl --pretty").toString().trim();
      return prettyname === "" ? os.hostname() : prettyname;
    default:
      return os.hostname();
  }
}