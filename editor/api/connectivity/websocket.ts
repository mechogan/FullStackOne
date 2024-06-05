import { ConnecterRequester } from "../../../src/connectivity/connecter/requester";
import { PeerNearbyBonjour } from "../../../src/connectivity/types";

export class ConnectWebSocket implements ConnecterRequester {
    connections: { id: string; trusted: boolean; ws: WebSocket }[] = [];

    onPeerConnectionResponse: (
        id: string,
        peerConnectionRequestStr: string
    ) => void;
    onPeerData: (id: string, data: string) => void;
    onPeerConnectionLost: (id: string) => void;
    onOpenConnection: (id: string) => void;

    private tryToConnectWebSocket(
        address: string,
        secure: boolean,
        port?: number
    ) {
        const hostname = address.includes(":") ? `[${address}]` : address;
        const protocol = secure ? "wss" : "ws";
        const url = protocol + "://" + hostname + (port ? `:${port}` : "");

        console.log(url);

        return new Promise<WebSocket>((resolve, reject) => {
            let ws: WebSocket,
                didResolve = false;
            try {
                ws = new WebSocket(url);
            } catch (e) {
                reject();
            }

            setTimeout(() => {
                if(didResolve) return;
                reject();
            }, 1000 * 5) // 5s timeout

            ws.onerror = () => {
                reject();
            };

            ws.onopen = () => {
                didResolve = true;
                resolve(ws);
            };
        });
    }

    async open(id: string, peerNearby: PeerNearbyBonjour) {
        let ws: WebSocket;

        console.log(peerNearby.addresses);
        
        for (const address of peerNearby.addresses) {
            try {
                ws = await this.tryToConnectWebSocket(
                    address,
                    false,
                    peerNearby.port
                );
                break;
            } catch (e) {}
        }

        console.log(ws);

        if (!ws) return;

        this.connections.push({
            id,
            trusted: false,
            ws
        });

        const onopen = () => {
            this.onOpenConnection?.(id);
        };
        ws.onopen = onopen;
        if (ws.readyState === WebSocket.OPEN) {
            onopen();
        }

        ws.onclose = () => {
            const indexOf = this.connections.findIndex(
                (conn) => conn.id === id
            );
            if (indexOf <= -1) return;
            this.connections.splice(indexOf, 1);
            this.onPeerConnectionLost?.(id);
        };
        ws.onmessage = (message) => {
            if (message.type === "binary") {
                console.log("Binary message on websocket is not yet supported");
                return;
            }

            const connection = this.connections.find((conn) => conn.id === id);
            if (!connection.trusted) {
                this.onPeerConnectionResponse?.(id, message.data);
            } else {
                this.onPeerData?.(id, message.data);
            }
        };
    }

    requestConnection(id: string, peerConnectionRequestStr: string): void {
        const connection = this.connections.find((conn) => conn.id === id);
        if (!connection) return;
        connection.ws.send(peerConnectionRequestStr);
    }

    trustConnection(id: string): void {
        const connection = this.connections.find((conn) => conn.id === id);
        if (!connection) return;
        connection.trusted = true;
    }

    disconnect(id: string): void {
        const indexOf = this.connections.findIndex((conn) => conn.id === id);
        this.connections[indexOf]?.ws.close();
    }

    send(id: string, data: string): void {
        const connection = this.connections.find((conn) => conn.id === id);
        if (!connection?.trusted) return;
        connection.ws.send(data);
    }
}
