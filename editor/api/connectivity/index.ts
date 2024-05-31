import config from "../config";
import { CONFIG_TYPE } from "../config/types";
import rpc from "../../rpc";
import { PEER_ADVERSTISING_METHOD, PEER_CONNECTION_REQUEST_TYPE, PEER_CONNECTION_STATE, PEER_CONNECTION_TYPE, Peer, PeerConnection, PeerConnectionPairing, PeerConnectionRequest, PeerConnectionRequestPairing, PeerConnectionRequestTrusted, PeerNearby, PeerNearbyBonjour } from "../../../src/adapter/connectivity";
import { Peers } from "../../views/peers";

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
            return peersConnections.concat(Array.from(peersWebSocket.values()));
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
    },
    async disconnect(peerConnection: PeerConnection) {
        switch(peerConnection.type) {
            case PEER_CONNECTION_TYPE.IOS_MULTIPEER:
            case PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER:
                rpc().connectivity.disconnect(peerConnection);
                break;
            case PEER_CONNECTION_TYPE.WEB_SOCKET:
                for(const [ws, {id}] of peersWebSocket){
                    if(id === peerConnection.id) {
                        peersWebSocket.delete(ws);
                        ws.close();
                        onPush["peerConnection"]("disconnected");
                        break;
                    }
                }
                break;
        }
    }
}

const peersWebSocket: Map<WebSocket, PeerConnection> = new Map();

function tryToConnectWebSocket(address: string, secure: boolean, port?: number) {
    const hostname = address.includes(":") ? `[${address}]` : address;
    const protocol = secure ? "wss" : "ws";
    const url = protocol + "://" + hostname + (port ? `:${port}` : "");

    return new Promise<WebSocket>((resolve, reject) => {
        let ws: WebSocket;
        try {
            ws = new WebSocket(url);
        } catch (e) {
            reject();
        }

        ws.onerror = () => {
            reject();
        }
        
        ws.onopen = () => {
            resolve(ws)
        };
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

    const id = randomIntFromInterval(100000, 999999);

    const peerTrusted = (await connectivityAPI.peers.trusted())
        .find(({ id }) => id === peerNearbyBonjour.peer.id);

    const peerConnection: PeerConnection = peerTrusted
        ? {
            id,
            peer: peerTrusted,
            state: PEER_CONNECTION_STATE.UNTRUSTED,
            type: PEER_CONNECTION_TYPE.WEB_SOCKET
        }
        : {
            id,
            peer: peerNearbyBonjour.peer,
            state: PEER_CONNECTION_STATE.PAIRING,
            type: PEER_CONNECTION_TYPE.WEB_SOCKET,
            secret: crypto.randomUUID(),
            key: crypto.randomUUID(),
            validation: randomIntFromInterval(1000, 9999)
        }

    ws.onclose = () => connectivityAPI.disconnect(peerConnection);

    if(peerConnection.state === PEER_CONNECTION_STATE.PAIRING) {
        const peerConnectionRequest: PeerConnectionRequestPairing = {
            secret: (peerConnection as PeerConnectionPairing).secret,
            key: (peerConnection as PeerConnectionPairing).key,
            validation: (peerConnection as PeerConnectionPairing).validation,
            peer: {
                id: me,
                name: await rpc().connectivity.name(),
            },
            type: PEER_CONNECTION_REQUEST_TYPE.PAIRING
        }
        ws.send(JSON.stringify(peerConnectionRequest));
    } else {
        const peerConnectionRequest: PeerConnectionRequestTrusted = {
            type: PEER_CONNECTION_REQUEST_TYPE.TRUSTED,
            peer: {
                id: me,
                name: await rpc().connectivity.name(),
            },
            secret: ""
        }
        ws.send(JSON.stringify(peerConnectionRequest))
    }
    
    peersWebSocket.set(ws, peerConnection);
}

onPush["peerConnectionRequest"] = async peerConnectionRequestStr => {
    let peerConnectionRequest: PeerConnectionRequest, 
        peerConnectionId: number,
        peerConnectionType: PEER_CONNECTION_TYPE;
    try {
        const message = JSON.parse(peerConnectionRequestStr);
        peerConnectionRequest = JSON.parse(message.peerConnectionRequest);
        peerConnectionId = message.id;
        peerConnectionType = message.type;
    } catch(e) {
        console.error("Unable to parse Peer Connection Request");
        return;
    }

    if (peerConnectionRequest.type === undefined) {
        console.error("No type in Peer Connection Request");
        return;
    }

    const requiredProperties = ["peer", "secret"];
    if(peerConnectionRequest.type === PEER_CONNECTION_REQUEST_TYPE.PAIRING) {
        requiredProperties.push("validation", "key");
    }

    for (const property of requiredProperties) {
        if(peerConnectionRequest[property] === undefined) {
            console.error(`Missing ${property} on Peer Connection Request`);
            return;
        }
    }

    if(!peerConnectionRequest.peer.id) {
        console.error("No peer.id in Peer Connection Request");
        return;
    } else if(!peerConnectionRequest.peer.name) {
        console.error("No peer.name in Peer Connection Request");
        return;
    }

    if(peerConnectionRequest.type === PEER_CONNECTION_REQUEST_TYPE.PAIRING) {
        const trust = await Peers.peerConnectionRequestPairingDialog(peerConnectionRequest.peer.name, peerConnectionRequest.validation)
        if(!trust) {
            connectivityAPI.disconnect({
                id: peerConnectionId,
                state: PEER_CONNECTION_STATE.PAIRING,
                peer: peerConnectionRequest.peer,
                type: peerConnectionType,
                validation: 0,
                secret: "",
                key: ""
            })
            return;
        }
    }
}

export default connectivityAPI;

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}