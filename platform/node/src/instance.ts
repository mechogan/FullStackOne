import http from "http";
import ws from "ws";

export class Instance {
    static platform = "node";

    static port = 9000;
    port: number;

    privileged = false;

    server: http.Server;
    wss: ws.WebSocketServer;
    webSockets: Set<ws.WebSocket>;

    baseDirectory: string;

    constructor(
        baseDirectory: string
    ) {
        this.baseDirectory = baseDirectory;
    }

    
}
