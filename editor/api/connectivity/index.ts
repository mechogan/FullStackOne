import config from "../config";
import { CONFIG_TYPE } from "../config/types";
import rpc from "../../rpc";
import { PEER_ADVERSTISING_METHOD, PEER_CONNECTION_REQUEST_TYPE, PEER_CONNECTION_STATE, PEER_CONNECTION_TYPE, Peer, PeerConnection, PeerConnectionPairing, PeerConnectionRequest, PeerConnectionRequestPairing, PeerConnectionRequestTrusted, PeerConnectionTrusted, PeerNearby, PeerNearbyBonjour, PeerTrusted } from "../../../src/adapter/connectivity";
import { Peers } from "../../views/peers";
import api from "..";

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
    pair(peerNearby: PeerNearby) {
        switch (peerNearby.type) {
            case PEER_ADVERSTISING_METHOD.BONJOUR:
                return connectByWebSocket(peerNearby);
            case PEER_ADVERSTISING_METHOD.IOS_MULTIPEER:

                break;
        }
    },
    async forget(peerTrusted: PeerTrusted){
        const peersTrusted = await connectivityAPI.peers.trusted();
        const indexOf = peersTrusted.findIndex(({id}) => id === peerTrusted.id);
        if(indexOf >= 0) {
            peersTrusted.splice(indexOf, 1);
        }
        await config.save(CONFIG_TYPE.CONNECTIVITY, {
            me,
            peersTrusted
        });
    },
    async disconnect(peerConnection: PeerConnection) {
        switch (peerConnection.type) {
            case PEER_CONNECTION_TYPE.IOS_MULTIPEER:
            case PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER:
                rpc().connectivity.disconnect(peerConnection);
                break;
            case PEER_CONNECTION_TYPE.WEB_SOCKET:
                for (const [ws, { id }] of peersWebSocket) {
                    if (id === peerConnection.id) {
                        peersWebSocket.delete(ws);
                        ws.close();
                        onPush["peerConnection"]("disconnected");
                        break;
                    }
                }
                break;
        }
    },
    async connect(peerConnection: PeerConnection, peerConnectionResponse: PeerConnectionRequest) {
        switch (peerConnection.type) {
            case PEER_CONNECTION_TYPE.IOS_MULTIPEER:
            case PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER:
                await rpc().connectivity.connect(peerConnection, peerConnectionResponse);
                break;
            case PEER_CONNECTION_TYPE.WEB_SOCKET:
                break;
        }
        onPush["peerConnection"]("connected");
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

async function pair(peerConnection: PeerConnection, peerConnectionRequest: PeerConnectionRequestPairing) {
    if(peerConnection.state !== PEER_CONNECTION_STATE.PAIRING) {
        return connectivityAPI.disconnect(peerConnection);
    }

    if(peerConnectionRequest.validation !== (peerConnection as PeerConnectionPairing).validation) {
        return connectivityAPI.disconnect(peerConnection);
    }
    
    const peerTrusted: PeerTrusted = {
        ...peerConnectionRequest.peer,
        keys: {
            encrypt: (peerConnection as PeerConnectionPairing).key,
            decrypt: peerConnectionRequest.key
        },
        secret : {
            own: (peerConnection as PeerConnectionPairing).secret,
            their: await decrypt(peerConnectionRequest.secret, peerConnectionRequest.key)
        }
    }

    const peersTrusted = (await connectivityAPI.peers.trusted())
            .concat([peerTrusted]);

    await api.config.save(CONFIG_TYPE.CONNECTIVITY, {
        me,
        peersTrusted
    });

    peerConnection.peer = peerTrusted;
    peerConnection.state = PEER_CONNECTION_STATE.CONNECTED;
    delete (peerConnection as PeerConnectionPairing).key;
    delete (peerConnection as PeerConnectionPairing).secret;
    delete (peerConnection as PeerConnectionPairing).validation;

    onPush["peerConnection"]("connected");
}

async function trust(peerConnection: PeerConnection, peerConnectionRequest: PeerConnectionRequestTrusted) {
    const peerTrusted = (await connectivityAPI.peers.trusted())
            .find(({ id }) => id === peerConnectionRequest.peer.id);
    
    if(!peerTrusted) {
        return connectivityAPI.disconnect(peerConnection);
    }

    const ownSecret = await decrypt(peerConnectionRequest.secret, peerTrusted.keys.decrypt);
    
    if(ownSecret !== peerTrusted.secret.own) {
        return connectivityAPI.disconnect(peerConnection);
    }

    peerConnection.state = PEER_CONNECTION_STATE.CONNECTED;

    onPush["peerConnection"]("connected");
}

async function connectByWebSocket(peerNearbyBonjour: PeerNearbyBonjour) {
    let ws: WebSocket;
    for (const address of peerNearbyBonjour.addresses) {
        try {
            ws = await tryToConnectWebSocket(address, false, peerNearbyBonjour.port);
            break;
        } catch (e) { }
    }

    if (!ws) return;

    ws.onmessage = message => {
        if (message.type === "binary") {
            console.log("Binary message on websocket is not yet supported")
            return;
        }
        const data = JSON.parse(message.data as string);

        const peerConnection = peersWebSocket.get(ws);
        switch(peerConnection.state) {
            case PEER_CONNECTION_STATE.PAIRING:
                pair(peerConnection, data)
                break;
            case PEER_CONNECTION_STATE.UNTRUSTED:
                trust(peerConnection, data)
                break;
            case PEER_CONNECTION_STATE.CONNECTED:

                break;
        }
    };

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
            key: generateHash(32),
            secret: generateHash(12),
            validation: randomIntFromInterval(1000, 9999)
        }

    ws.onclose = () => connectivityAPI.disconnect(peerConnection);

    if (peerConnection.state === PEER_CONNECTION_STATE.PAIRING) {
        const peerConnectionRequest: PeerConnectionRequestPairing = {
            secret: await encrypt((peerConnection as PeerConnectionPairing).secret, (peerConnection as PeerConnectionPairing).key),
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
            secret: await encrypt(peerTrusted.secret.their, peerTrusted.keys.encrypt)
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
    } catch (e) {
        console.error("Unable to parse Peer Connection Request");
        return;
    }

    if (peerConnectionRequest.type === undefined) {
        console.error("No type in Peer Connection Request");
        return;
    }

    const requiredProperties = ["peer", "secret"];
    if (peerConnectionRequest.type === PEER_CONNECTION_REQUEST_TYPE.PAIRING) {
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

    let peerConnectionResponse: PeerConnectionRequest, peerTrusted: PeerTrusted;
    if (peerConnectionRequest.type === PEER_CONNECTION_REQUEST_TYPE.PAIRING) {
        const trust = await Peers.peerConnectionRequestPairingDialog(peerConnectionRequest.peer.name, peerConnectionRequest.validation)
        if (!trust) {
            return connectivityAPI.disconnect({
                id: peerConnectionId,
                state: PEER_CONNECTION_STATE.UNTRUSTED,
                peer: null,
                type: peerConnectionType
            });
        }

        peerTrusted = {
            ...peerConnectionRequest.peer,
            keys: {
                decrypt: peerConnectionRequest.key,
                encrypt: generateHash(32)
            },
            secret: {
                their: await decrypt(peerConnectionRequest.secret, peerConnectionRequest.key),
                own: generateHash(12)
            }
        }

        const peersTrusted = (await connectivityAPI.peers.trusted())
            .concat([peerTrusted]);

        await api.config.save(CONFIG_TYPE.CONNECTIVITY, {
            me,
            peersTrusted
        });

        peerConnectionResponse = {
            type: PEER_CONNECTION_REQUEST_TYPE.PAIRING,
            peer: {
                id: me,
                name: await rpc().connectivity.name()
            },
            key: peerTrusted.keys.encrypt,
            secret: await encrypt(peerTrusted.secret.own, peerTrusted.keys.encrypt),
            validation: peerConnectionRequest.validation
        }
    } else {
        peerTrusted = (await connectivityAPI.peers.trusted()).find(({ id }) => id === peerConnectionRequest.peer.id);

        if (!peerTrusted) {
            return connectivityAPI.disconnect({
                id: peerConnectionId,
                state: PEER_CONNECTION_STATE.UNTRUSTED,
                peer: null,
                type: peerConnectionType
            })
        }

        const ownSecret = await decrypt(peerConnectionRequest.secret, peerTrusted.keys.decrypt);

        if (ownSecret !== peerTrusted.secret.own) {
            return connectivityAPI.disconnect({
                id: peerConnectionId,
                state: PEER_CONNECTION_STATE.UNTRUSTED,
                peer: null,
                type: peerConnectionType
            });
        }

        peerConnectionResponse = {
            type: PEER_CONNECTION_REQUEST_TYPE.TRUSTED,
            peer: {
                id: me,
                name: await rpc().connectivity.name()
            },
            secret: await encrypt(peerTrusted.secret.their, peerTrusted.keys.encrypt)
        }
    }

    if (!peerTrusted) {
        return connectivityAPI.disconnect({
            id: peerConnectionId,
            state: PEER_CONNECTION_STATE.UNTRUSTED,
            peer: null,
            type: peerConnectionType
        });
    }

    const peerConnection: PeerConnection = {
        id: peerConnectionId,
        type: peerConnectionType,
        peer: peerTrusted,
        state: PEER_CONNECTION_STATE.CONNECTED,
    }

    connectivityAPI.connect(peerConnection, peerConnectionResponse);
}

export default connectivityAPI;

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}


// for large strings, use this from https://stackoverflow.com/a/49124600
const toBase64 = (data: ArrayBufferLike) => btoa(
    new Uint8Array(data).reduce(
        (data, byte) => data + String.fromCharCode(byte), ''
    )
);

const fromBase64 = (data: string) =>
    Uint8Array.from(atob(data), (c) => c.charCodeAt(null));


const generateHash = (byteLength: number) => toBase64(crypto.getRandomValues(new Uint8Array(byteLength)));

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function encrypt(data: string, key: string) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await importKey(key);
    const derivedKey = await deriveKey(cryptoKey, salt, "encrypt");
    const encryptedContent = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
        },
        derivedKey,
        textEncoder.encode(data)
    );

    const encryptedContentArr = new Uint8Array(encryptedContent);
    let buff = new Uint8Array(
        salt.byteLength + iv.byteLength + encryptedContentArr.byteLength
    );
    buff.set(salt, 0);
    buff.set(iv, salt.byteLength);
    buff.set(encryptedContentArr, salt.byteLength + iv.byteLength);
    return toBase64(buff);
}

async function decrypt(base64: string, key: string) {
    const encryptedDataBuff = fromBase64(base64);
    const salt = encryptedDataBuff.slice(0, 16);
    const iv = encryptedDataBuff.slice(16, 16 + 12);
    const data = encryptedDataBuff.slice(16 + 12);
    const cryptoKey = await importKey(key);
    const derivedKey = await deriveKey(cryptoKey, salt, "decrypt");
    const decryptedContent = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv,
        },
        derivedKey,
        data
    );
    return textDecoder.decode(decryptedContent);
}

const importKey = (key: string) => crypto.subtle.importKey(
    "raw",
    textEncoder.encode(key),
    "PBKDF2",
    false,
    ["deriveKey"]);

const deriveKey = (cryptoKey: CryptoKey, salt: ArrayBufferLike, keyUsage: "encrypt" | "decrypt") => crypto.subtle.deriveKey(
    {
        name: "PBKDF2",
        salt,
        iterations: 250000,
        hash: "SHA-256",
    },
    cryptoKey,
    { name: "AES-GCM", length: 256 },
    false,
    [keyUsage]
);