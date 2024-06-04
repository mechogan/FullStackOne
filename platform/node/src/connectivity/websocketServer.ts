import { ConnecterResponder } from "../../../../src/connectivity/connecter/responder";
import { WebSocketServer as WSS, WebSocket } from "ws";
import crypto from "crypto";

export class WebSocketServer implements ConnecterResponder {
    port = randomIntFromInterval(10000, 60000);
    wss = new WSS({ port: this.port });

    connections: { id: string; trusted: boolean; ws: WebSocket }[] = [];

    onPeerConnectionRequest: (id: string, peerConnectionRequestStr: string) => void;
    onPeerData: (id: string, data: string) => void;
    onPeerConnectionLost: (id: string) => void;

    constructor(){
        this.wss.on("connection", ws => {
            const id = crypto.randomUUID();

            ws.on("close", () => {
                const indexOf = this.connections.findIndex(conn => conn.id === id);
                if(indexOf <= -1) return;
                this.connections.splice(indexOf, 1);
                this.onPeerConnectionLost?.(id);
            });

            this.connections.push({
                id,
                trusted: false,
                ws
            })

            ws.onmessage = message => {
                if(message.type === "binary") {
                    console.log("Binary message on websocket is not yet supported")
                    return;
                }

                const data = message.data as string;

                const connection = this.connections.find(conn => conn.ws === ws);
                if (!connection) {
                    return;
                } else if(!connection.trusted) {
                    this.onPeerConnectionRequest?.(connection.id, data);
                } else {
                    this.onPeerData?.(connection.id, data);
                }
            };
        });
    }

    respondToConnectionRequest(id: string, peerConnectionResponseStr: string): void {
        const connection = this.connections.find(conn => conn.id === id);
        if(!connection) return;
        connection.ws.send(peerConnectionResponseStr);
    }

    trustConnection(id: string) {
        const connection = this.connections.find(conn => conn.id === id);
        if(!connection) return;
        connection.trusted = true;
    }

    disconnect(id: string): void {
        const indexOf = this.connections.findIndex(conn => conn.id === id);
        this.connections[indexOf]?.ws.close();
    }

    send(id: string, data: string): void {
        const connection = this.connections.find(conn => conn.id === id);
        if(!connection?.trusted) return;
        connection.ws.send(data);
    }

}

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}