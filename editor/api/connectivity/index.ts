import config from "../config";
import { CONFIG_TYPE } from "../config/types";
import rpc from "../../rpc";
import { PEER_ADVERSTISING_METHOD, PEER_CONNECTION_STATE, PEER_CONNECTION_TYPE, Peer, PeerConnection, PeerNearby, PeerNearbyBonjour } from "../../../src/adapter/connectivity";

let me: Peer["id"];

let advertiseTimeout: ReturnType<typeof setTimeout>;

const connectivityAPI = {
    async init() {
        let connectivityConfig = await config.load(CONFIG_TYPE.CONNECTIVITY);
        if (!connectivityConfig) {
            connectivityConfig = {
                me: crypto.randomUUID(),
                peersTrusted: []
            }
            await config.save(CONFIG_TYPE.CONNECTIVITY, connectivityConfig);
        }

        me = connectivityConfig.me;
    },
    peers: {
        async trusted() {
            return (await config.load(CONFIG_TYPE.CONNECTIVITY)).peersTrusted;
        },
        async connections() {
            const peersConnections = await rpc().connectivity.peers.connections();
            return peersConnections.concat(Array.from(peersWebSocket));
        },
        nearby() {
            return rpc().connectivity.peers.nearby();
        }
    },
    advertise(forMS = 5000) {
        if (advertiseTimeout)
            clearTimeout(advertiseTimeout);

        rpc().connectivity.advertise.start(me);

        advertiseTimeout = setTimeout(() => {
            rpc().connectivity.advertise.stop().then(() => advertiseTimeout = undefined);
        }, forMS)
    },
    connect(peerNearby: PeerNearby) {
        switch (peerNearby.type) {
            case PEER_ADVERSTISING_METHOD.BONJOUR:
                return connectByWebSocket(peerNearby);
            case PEER_ADVERSTISING_METHOD.IOS_MULTIPEER:
    
                break;
        }
    }
}

const peersWebSocket: (PeerConnection & { ws: WebSocket })[] = [];

function tryToConnectWebSocket(address: string, secure: boolean, port?: number) {
    const hostname = address.includes(":") ? `[${address}]` : address;
    const protocol = secure ? "wss" : "ws";
    const url = protocol + ";//" + hostname + (port ? `:${port}` : "");

    return new Promise<WebSocket>(resolve => {
        const ws = new WebSocket(url);
        ws.onopen = () => resolve(ws);
    });
}

async function connectByWebSocket(peerNearbyBonjour: PeerNearbyBonjour) {
    let ws: WebSocket;
    for(const address of peerNearbyBonjour.addresses) {
        try {
            ws = await tryToConnectWebSocket(address, false, peerNearbyBonjour.port);
            break;
        } catch(e) { }
    }

    if(!ws) return;

    const peerTrusted = (await connectivityAPI.peers.trusted())
        .find(({id}) => id === peerNearbyBonjour.id);
    
    const peerConnection: PeerConnection = peerTrusted
        ? {
            ...peerTrusted,
            state: PEER_CONNECTION_STATE.UNTRUSTED,
            type: PEER_CONNECTION_TYPE.WEB_SOCKET
        }
        : {
            ...peerNearbyBonjour,
            state: PEER_CONNECTION_STATE.PAIRING,
            type: PEER_CONNECTION_TYPE.WEB_SOCKET,
            secret: crypto.randomUUID(),
            key: crypto.randomUUID(),
            validation: randomIntFromInterval(1000, 9999)
        }

    if(peerConnection.state === PEER_CONNECTION_STATE.PAIRING) {
        ws.send(JSON.stringify(peerConnection));
    }
    
    peersWebSocket.push({
        ...peerConnection,
        ws
    });
}

export default connectivityAPI;

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}