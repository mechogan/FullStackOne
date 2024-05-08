import { Bonjour } from 'bonjour-service';
import { WebSocket, WebSocketServer } from "ws";
import { randomUUID } from 'crypto';
import os from "os";

export type Peer = {
    connected: boolean,
    name: string,
    port: number,
    addresses: string[]
}

export class Multipeer {
    bonjour = new Bonjour();
    port = randomIntFromInterval(10000, 60000);
    wss = new WebSocketServer({ port: this.port });
    onMessage: (data: any) => void;

    static peers = new Set<WebSocket>();

    constructor(onMessage: (data: any) => void){
        this.onMessage = onMessage;

        this.wss.on("connection", (ws) => {
            console.log("Connected with new peer")
            Multipeer.peers.add(ws);
            ws.onmessage = ({data}) => this.onMessage(data);
        });
    }

    advertise(){
        const networkInterfaces = os.networkInterfaces();
        const addresses = new Set<string>();

        const interfaces = ["en0", "wlan0"];

        interfaces.forEach(netInterface => {
            if(!networkInterfaces[netInterface]) return;
            networkInterfaces[netInterface].forEach(({address}) => addresses.add(address));
        });

        const name = randomUUID();
        const advertiser = this.bonjour.publish({ 
            name, 
            type: 'fullstacked', 
            port: this.port,
            txt: {
                _d:  name,
                addresses: Array.from(addresses).join(","),
                port: this.port
            }
        });

        setTimeout(() => { advertiser.stop() }, 30000);
    }

    browse(onService: (peer: Peer) => void){
        this.bonjour.find({ type: 'fullstacked' }, service => {
            if(service.port === this.port) return;

            onService({
                ...service,
                connected: false,
                addresses: service.addresses || []
            });
        });
    }

    async pair(peer: Peer){
        let paired = false;
        for(const addresse of peer.addresses) {
            if(paired) break;
            try {
                await new Promise<void>(resolve => {
                    const url = "ws://" + addresse + ":" + peer.port;
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
        Multipeer.peers.forEach(ws => ws.send(data));
    }
}


function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}