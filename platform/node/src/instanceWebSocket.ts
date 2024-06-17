import ws from "ws";

export class InstanceWebSocket {
    wss: ws.WebSocketServer;
    webSockets: Set<ws.WebSocket> = new Set();
    
    constructor(webSocketServer: ws.WebSocketServer) {
        this.wss = webSocketServer;
    }

    push(messageType: string, message: string): void {
        this.webSockets.forEach((ws) =>
            ws.send(JSON.stringify({ messageType, message }))
        );
    }
    
    restart() {
        this.push("restart", "");
    }
}