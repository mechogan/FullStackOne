import config from "../config";
import { CONFIG_TYPE } from "../config/types";
import rpc from "../../rpc";
import { Peers } from "../../views/peers";
import api from "..";
import { ConnectWebSocket } from "./websocket";
import { PEER_ADVERSTISING_METHOD, PEER_CONNECTION_REQUEST_TYPE, PEER_CONNECTION_STATE, PEER_CONNECTION_TYPE, Peer, PeerConnection, PeerConnectionPairing, PeerConnectionRequest, PeerConnectionRequestCommon, PeerConnectionRequestPairing, PeerConnectionTrusted, PeerNearby, PeerTrusted } from "../../../src/connectivity/types";
import { decrypt, encrypt, generateHash } from "./cryptoUtils";

let me: Peer;
let advertiseTimeout: ReturnType<typeof setTimeout>;

const peersConnections = new Map<string, PeerConnection>();

const connecterWebSocket = new ConnectWebSocket();
connecterWebSocket.onOpenConnection = (id) => onOpenConnection(id, PEER_CONNECTION_TYPE.WEB_SOCKET);
connecterWebSocket.onPeerConnectionLost = onPeerConnectionLost;
connecterWebSocket.onPeerConnectionResponse = (id, peerConectionResponseStr) => onPeerConnectionResponse(id, PEER_CONNECTION_TYPE.WEB_SOCKET, peerConectionResponseStr);
connecterWebSocket.onPeerData = onPeerData;

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

        me = {
            id: connectivityConfig.me,
            name: await rpc().connectivity.name()
        };

        rpc().connectivity.browse.start();
    },
    peers: {
        async trusted() {
            return (await config.load(CONFIG_TYPE.CONNECTIVITY)).peersTrusted;
        },
        async connections() {
            return Array.from(peersConnections.values());
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
        let id: string;
        switch (peerNearby.type) {
            case PEER_ADVERSTISING_METHOD.BONJOUR:
                id = crypto.randomUUID();
                connecterWebSocket.open(id, peerNearby);
                break;
            case PEER_ADVERSTISING_METHOD.IOS_MULTIPEER:
                id = peerNearby.id;
                rpc().connectivity.open(peerNearby.id);
                break;
        }

        peersConnections.set(id, {
            id,
            state: PEER_CONNECTION_STATE.NOT_CONNECTED,
            peer: peerNearby.peer,
            type: null
        });
    },
    async forget(peerTrusted: PeerTrusted){
        const peersTrusted = await connectivityAPI.peers.trusted();
        const indexOf = peersTrusted.findIndex(({id}) => id === peerTrusted.id);
        if(indexOf <= -1)  return;
        peersTrusted.splice(indexOf, 1);
        await config.save(CONFIG_TYPE.CONNECTIVITY, {
            me: me.id,
            peersTrusted
        });
    },
    async disconnect(peerConnection: PeerConnection) {
        switch (peerConnection.type) {
            case PEER_CONNECTION_TYPE.IOS_MULTIPEER:
            case PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER:
                rpc().connectivity.disconnect(peerConnection.id);
                break;
            case PEER_CONNECTION_TYPE.WEB_SOCKET:
                connecterWebSocket.disconnect(peerConnection.id);
                break;
        }
    }
}

export default connectivityAPI;


async function saveNewPeerTrusted(peerTrusted: PeerTrusted) {
    const peersTrusted = await connectivityAPI.peers.trusted();
    peersTrusted.push(peerTrusted);

    await api.config.save(CONFIG_TYPE.CONNECTIVITY, {
        me: me.id,
        peersTrusted,
    });
}


onPush["openConnection"] = (eventStr: string) => {
    const event = JSON.parse(eventStr);

    const id: string = event.id;
    const type = event.type;

    onOpenConnection(id, type);
}

async function onOpenConnection(id: string, type: PEER_CONNECTION_TYPE) {
    console.log("onOpenConnection");

    const peerConnection = peersConnections.get(id);
    
    if(!peerConnection) return;

    peerConnection.type = type;

    const peerTrusted = (await connectivityAPI.peers.trusted())
        .find(peer => peer.id === peerConnection.peer.id);

    if(!peerTrusted) {
        pair(id);
    } else {
        handshake(id, peerTrusted);
    }
}

async function pair(id: string){
    const peerConnection = peersConnections.get(id) as PeerConnectionPairing;
    if(!peerConnection) return;

    peerConnection.state = PEER_CONNECTION_STATE.PAIRING;

    peerConnection.key = generateHash(32);
    peerConnection.secret = generateHash(12);
    peerConnection.validation = randomIntFromInterval(1000, 9999);

    const peerConnectionRequest: PeerConnectionRequestPairing = {
        request_type: PEER_CONNECTION_REQUEST_TYPE.PAIRING,
        key: peerConnection.key,
        secret: await encrypt(peerConnection.secret, peerConnection.key),
        peer: me,
        validation: peerConnection.validation
    }

    sendPeerConnectionRequest(id, peerConnection.type, peerConnectionRequest);
}

async function handshake(id: string, peerTrusted: PeerTrusted) {
    const peerConnection = peersConnections.get(id);
    if(!peerConnection) return;

    peerConnection.state = PEER_CONNECTION_STATE.UNTRUSTED;

    const peerConnectionRequest: PeerConnectionRequestCommon = {
        request_type: PEER_CONNECTION_REQUEST_TYPE.TRUSTED,
        peer: me,
        secret: await encrypt(peerTrusted.secret.own, peerTrusted.keys.encrypt)
    }

    sendPeerConnectionRequest(id, peerConnection.type, peerConnectionRequest);
}

function sendPeerConnectionRequest(id: string, type: PEER_CONNECTION_TYPE, peerConnectionRequest: PeerConnectionRequest) {
    switch(type) {
        case PEER_CONNECTION_TYPE.WEB_SOCKET:
            connecterWebSocket.requestConnection(id, JSON.stringify(peerConnectionRequest));
            break;
        case PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER:
        case PEER_CONNECTION_TYPE.IOS_MULTIPEER:
            rpc().connectivity.requestConnection(id, JSON.stringify(peerConnectionRequest))
            break;
    }
    onPush["peerConnectionEvent"](null);
}

onPush["peerConnectionRequest"] = (eventStr: string) => {
    const event = JSON.parse(eventStr);

    const id: string = event.id;
    const type: PEER_CONNECTION_TYPE = event.type;

    let peerConnectionRequest: PeerConnectionRequest;
    try {
        peerConnectionRequest = JSON.parse(event.peerConnectionRequestStr)
    } catch (e) { 
        console.error("Unable to parse Peer Connection Request");
        return;
    }

    onPeerConnectionRequest(id, type, peerConnectionRequest);
}

function onPeerConnectionRequest(id: string, type: PEER_CONNECTION_TYPE, peerConnectionRequest: PeerConnectionRequest) {
    console.log("onPeerConnectionRequest");

    if (peerConnectionRequest.request_type === undefined) {
        console.error("No request_type in Peer Connection Request");
        return;
    }

    const requiredProperties = ["peer", "secret"];
    if (peerConnectionRequest.request_type === PEER_CONNECTION_REQUEST_TYPE.PAIRING) {
        requiredProperties.push("validation", "key");
    }

    for (const property of requiredProperties) {
        if (peerConnectionRequest[property] === undefined) {
            console.error(`Missing ${property} on Peer Connection Request`);
            return;
        }
    }

    if (!peerConnectionRequest.peer.id) {
        console.error("No peer.id in Peer Connection Request");
        return;
    } else if (!peerConnectionRequest.peer.name) {
        console.error("No peer.name in Peer Connection Request");
        return;
    }


    switch(peerConnectionRequest.request_type) {
        case PEER_CONNECTION_REQUEST_TYPE.PAIRING:
            pairRespond(id, type, peerConnectionRequest as PeerConnectionRequestPairing);
            break;
        case PEER_CONNECTION_REQUEST_TYPE.TRUSTED:
            handshakeRespond(id, type, peerConnectionRequest);
            break;
    }
}

async function pairRespond(id: string, type: PEER_CONNECTION_TYPE, peerConnectionRequest: PeerConnectionRequestPairing){
    const trust = await Peers.peerConnectionRequestPairingDialog(peerConnectionRequest.peer.name, peerConnectionRequest.validation)
    if(!trust) {
        return connectivityAPI.disconnect({
            id,
            type,
            state: PEER_CONNECTION_STATE.NOT_CONNECTED,
            peer: peerConnectionRequest.peer
        })
    }

    const peerTrusted: PeerTrusted = {
        id: peerConnectionRequest.peer.id,
        name: peerConnectionRequest.peer.name,
        keys: {
            decrypt: peerConnectionRequest.key,
            encrypt: generateHash(32)
        },
        secret: {
            their: await decrypt(peerConnectionRequest.secret, peerConnectionRequest.key),
            own: generateHash(12)
        }
    }

    await saveNewPeerTrusted(peerTrusted);

    const peerConnection: PeerConnection = {
        id,
        type,
        peer: peerTrusted,
        state: PEER_CONNECTION_STATE.CONNECTED
    }

    peersConnections.set(id, peerConnection);

    const peerConnectionResponse: PeerConnectionRequestPairing = {
        request_type: PEER_CONNECTION_REQUEST_TYPE.PAIRING,
        peer: me,
        validation: peerConnectionRequest.validation,
        key: peerTrusted.keys.encrypt,
        secret: await encrypt(peerTrusted.secret.own, peerTrusted.keys.encrypt)
    }

    sendPeerConnectionResponse(id, type, peerConnectionResponse);
}

async function handshakeRespond(id: string, type: PEER_CONNECTION_TYPE, peerConnectionRequest: PeerConnectionRequestCommon){
    const peerTrusted = (await connectivityAPI.peers.trusted())
        .find(({ id }) => peerConnectionRequest.peer.id === id);

    if(!peerTrusted) {
        return connectivityAPI.disconnect({
            id,
            type,
            state: PEER_CONNECTION_STATE.NOT_CONNECTED,
            peer: peerConnectionRequest.peer
        })
    }

    const theirSecret = await decrypt(peerConnectionRequest.secret, peerTrusted.keys.decrypt);

    if(theirSecret !== peerTrusted.secret.their) {
        return connectivityAPI.disconnect({
            id,
            type,
            state: PEER_CONNECTION_STATE.NOT_CONNECTED,
            peer: peerConnectionRequest.peer
        });
    }

    const peerConnection: PeerConnection = {
        id,
        type,
        state: PEER_CONNECTION_STATE.CONNECTED,
        peer: peerTrusted
    }

    peersConnections.set(id, peerConnection);

    const peerConnectionResponse: PeerConnectionRequestCommon = {
        peer: me,
        request_type: PEER_CONNECTION_REQUEST_TYPE.TRUSTED,
        secret: await encrypt(peerTrusted.secret.own, peerTrusted.keys.encrypt)
    }

    sendPeerConnectionResponse(id, type, peerConnectionResponse);
}

function sendPeerConnectionResponse(id: string, type: PEER_CONNECTION_TYPE, peerConnectionResponse: PeerConnectionRequest) {
    switch(type) {
        case PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER:
        case PEER_CONNECTION_TYPE.IOS_MULTIPEER:
            rpc().connectivity.respondToRequestConnection(id, JSON.stringify(peerConnectionResponse))
            break;
        case PEER_CONNECTION_TYPE.WEB_SOCKET:
            break;
    }

    trustConnection(id);
}

onPush["peerConnectionResponse"] = (eventStr: string) => {
    const event = JSON.parse(eventStr);

    const id = event.id;
    const type = event.type;
    const peerConectionResponseStr = event.peerConnectionResponseStr;

    onPeerConnectionResponse(id, type, peerConectionResponseStr);
}

function onPeerConnectionResponse(id: string, type: PEER_CONNECTION_TYPE, peerConnectionResponseStr: string){
    console.log("onPeerConnectionResponse");

    let peerConnectionResponse: PeerConnectionRequest;
    try {
        peerConnectionResponse = JSON.parse(peerConnectionResponseStr)
    } catch (e) { 
        console.error("Unable to parse Peer Connection Response");
        return;
    }
    
    if (peerConnectionResponse.request_type === undefined) {
        console.error("No request_type in Peer Connection Response");
        return;
    }

    const requiredProperties = ["peer", "secret"];
    if (peerConnectionResponse.request_type === PEER_CONNECTION_REQUEST_TYPE.PAIRING) {
        requiredProperties.push("validation", "key");
    }

    for (const property of requiredProperties) {
        if (peerConnectionResponse[property] === undefined) {
            console.error(`Missing ${property} on Peer Connection Response`);
            return;
        }
    }

    switch(peerConnectionResponse.request_type) {
        case PEER_CONNECTION_REQUEST_TYPE.PAIRING:
            pairComplete(id, type, peerConnectionResponse as PeerConnectionRequestPairing);
            break;
        case PEER_CONNECTION_REQUEST_TYPE.TRUSTED:
            handshakeComplete(id, type, peerConnectionResponse);
            break;
    }
}

async function pairComplete(id: string, type: PEER_CONNECTION_TYPE, peerConectionResponse: PeerConnectionRequestPairing){
    const peerConnection = peersConnections.get(id) as PeerConnectionPairing;

    if(!peerConnection || 
        !peerConnection.validation ||
        !peerConectionResponse.validation ||
        peerConnection.validation !== peerConectionResponse.validation) 
    {
        return connectivityAPI.disconnect({
            id,
            type,
            state: PEER_CONNECTION_STATE.NOT_CONNECTED,
            peer: peerConectionResponse.peer
        });
    }

    const peerTrusted: PeerTrusted = {
        id: peerConectionResponse.peer.id,
        name: peerConectionResponse.peer.name,
        keys: {
            encrypt: peerConnection.key,
            decrypt: peerConectionResponse.key
        },
        secret: {
            own: peerConnection.secret,
            their: await decrypt(peerConectionResponse.secret, peerConectionResponse.key)
        }
    }

    await saveNewPeerTrusted(peerTrusted);

    const peerConnectionTrusted: PeerConnection = {
        id,
        type,
        state: PEER_CONNECTION_STATE.CONNECTED,
        peer: peerTrusted
    }

    peersConnections.set(id, peerConnectionTrusted);

    trustConnection(id);
}

async function handshakeComplete(id: string, type: PEER_CONNECTION_TYPE, peerConnectionResponse: PeerConnectionRequestCommon) {
    const peerConnection = peersConnections.get(id);

    if(!peerConnection) {
        return connectivityAPI.disconnect({
            id,
            type,
            state: PEER_CONNECTION_STATE.NOT_CONNECTED,
            peer: peerConnectionResponse.peer
        });
    }

    const peerTrusted = (await connectivityAPI.peers.trusted())
        .find(({id}) => peerConnectionResponse.peer.id === id);

    if(!peerTrusted) {
        return connectivityAPI.disconnect({
            id,
            type,
            state: PEER_CONNECTION_STATE.NOT_CONNECTED,
            peer: peerConnectionResponse.peer
        });
    }

    const theirSecret = await decrypt(peerConnectionResponse.secret, peerTrusted.keys.decrypt);

    if(theirSecret !== peerTrusted.secret.their) {
        return connectivityAPI.disconnect({
            id,
            type,
            state: PEER_CONNECTION_STATE.NOT_CONNECTED,
            peer: peerConnectionResponse.peer
        });
    }

    peerConnection.state = PEER_CONNECTION_STATE.CONNECTED;
    peerConnection.peer = peerTrusted;

    trustConnection(id);
}

function trustConnection(id: string) {
    console.log("trustConnection");

    const peerConnection = peersConnections.get(id);

    switch (peerConnection.type) {
        case PEER_CONNECTION_TYPE.WEB_SOCKET:
            connecterWebSocket.trustConnection(id);
            break;
        case PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER:
        case PEER_CONNECTION_TYPE.IOS_MULTIPEER:
            rpc().connectivity.trustConnection(id);
            break;
    }

    onPush["peerConnectionEvent"](null);
}

onPush["peerConnectionLost"] = (eventStr: string) => {
    const event = JSON.parse(eventStr);
    const id = event.id;
    onPeerConnectionLost(id);
}

function onPeerConnectionLost(id: string) {
    console.log("onPeerConnectionLost");

    peersConnections.delete(id);
    onPush["peerConnectionEvent"](null);
}

onPush["peerData"] = (eventStr: string) => {
    const event = JSON.parse(eventStr);

    const id = event.id;
    const data = event.data;

    onPeerData(id, data);
}

async function onPeerData(id: string, data: string) {
    const peerConnection = peersConnections.get(id);

    if(peerConnection.state !== PEER_CONNECTION_STATE.CONNECTED) return;

    const decryptedData = await decrypt(data, peerConnection.peer.keys.decrypt);
    rpc().connectivity.convey(decryptedData);
}

onPush["sendData"] = (data: string) => {
    for(const peerConnection of peersConnections.values()){
        sendData(peerConnection, data);        
    }
}

async function sendData(peerConnection: PeerConnection, data: string) {
    if(peerConnection.state !== PEER_CONNECTION_STATE.CONNECTED) return;

    const encrypted = await encrypt(data, peerConnection.peer.keys.encrypt);
    switch(peerConnection.type) {
        case PEER_CONNECTION_TYPE.WEB_SOCKET:
            connecterWebSocket.send(peerConnection.id, encrypted);
            break;
        case PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER:
        case PEER_CONNECTION_TYPE.IOS_MULTIPEER:
            rpc().connectivity.send(peerConnection.id, encrypted);
            break;
    }
}


function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}