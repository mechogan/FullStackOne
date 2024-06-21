import crypto from "crypto";
import http from "http";
import { WebSocketServer as WSS, WebSocket } from "ws";
import { Connecter } from "../../../../src/connectivity/connecter";
import { PEER_CONNECTION_TYPE, Peer } from "../../../../src/connectivity/types";
import { Advertiser } from "../../../../src/connectivity/advertiser";

export class WebSocketServer implements Connecter, Advertiser {
    port = 14000;
    advertising: Peer = null;
    server: http.Server;
    wss: WSS;

    connections: { id: string; trusted: boolean; ws: WebSocket }[] = [];
    connectionRequests = new Set<string>();

    onPeerConnection: (id: string, type: PEER_CONNECTION_TYPE, state: "open" | "close") => void;
    onPeerData: (id: string, data: string) => void;

    constructor() {
        if(process.env.WSS_PORT) {
            const parsedInt = parseInt(process.env.WSS_PORT);
            this.port = parsedInt && !isNaN(parsedInt) ? parsedInt : this.port;
        }

        this.server = http.createServer(this.requestHandler.bind(this));
        this.server.listen(this.port);
        this.wss = new WSS({ server: this.server })

        this.wss.on("connection", (ws) => {
            const id = crypto.randomUUID();

            ws.on("close", () => {
                const indexOf = this.connections.findIndex(
                    (conn) => conn.id === id
                );
                if (indexOf <= -1) return;
                this.connections.splice(indexOf, 1);
                this.onPeerConnection?.(id, PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER, "close");
            });

            this.connections.push({
                id,
                trusted: false,
                ws
            });

            this.onPeerConnection?.(id, PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER, "open");

            ws.onmessage = (message) => {
                if (message.type === "binary") {
                    console.log(
                        "Binary message on websocket is not yet supported"
                    );
                    return;
                }

                const data = message.data as string;

                const connection = this.connections.find(
                    (conn) => conn.ws === ws
                );
                if (!connection) {
                    ws.close();
                    return;
                } else {
                    this.onPeerData?.(connection.id, data);
                }
            };
        });
    }

    requestHandler(req: http.IncomingMessage, res: http.ServerResponse) {
        if(!this.advertising) {
            res.writeHead(403);
            return res.end();
        }

        const response = JSON.stringify(this.advertising);
        res.writeHead(200, {
            "content-type": "application/json",
            "content-length": response.length,
            "access-aontrol-allow-origin": "*",
            "access-control-allow-methods": "GET"
        });
        res.end(response);
    }

    startAdvertising(me: Peer): void {
        this.advertising = me;
    }
    stopAdvertising(): void {
        this.advertising = null;
    }

    open(id: string): void {
        console.log("Web Socket Server is not supposed to open new connections");
    }

    trustConnection(id: string) {
        const connection = this.connections.find((conn) => conn.id === id);
        if (!connection) return;
        connection.trusted = true;
    }

    disconnect(id: string): void {
        const indexOf = this.connections.findIndex((conn) => conn.id === id);
        this.connections[indexOf]?.ws.close();
    }

    send(id: string, data: string, pairing = false): void {
        const connection = this.connections.find((conn) => conn.id === id);
        if (!connection?.trusted && !pairing) return;
        connection.ws.send(data);
    }
}