import config from "../config";
import { CONFIG_TYPE } from "../config/types";
import rpc from "../../rpc";
import { PEER_ADVERSTISING_METHOD, PEER_CONNECTION_REQUEST_TYPE, PEER_CONNECTION_STATE, PEER_CONNECTION_TYPE, Peer, PeerConnection, PeerConnectionPairing, PeerConnectionRequest, PeerConnectionRequestPairing, PeerConnectionRequestTrusted, PeerNearby, PeerNearbyBonjour, PeerTrusted } from "../../../src/adapter/connectivity";
import { Peers } from "../../views/peers";

let me: Peer["id"];

let advertiseTimeout: ReturnType<typeof setTimeout>;

const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));

const connectivityAPI = {
    async init() {

        const id = "cp";
        const data = "test";
        const key = "12345"

        console.log(await decrypt(await encrypt(data, key), key));


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
    pair(peerConnectionResponse: PeerConnectionRequest) {

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
    for (const address of peerNearbyBonjour.addresses) {
        try {
            ws = await tryToConnectWebSocket(address, false, peerNearbyBonjour.port);
            break;
        } catch (e) { }
    }

    if (!ws) return;

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
        console.log((peerConnection as PeerConnectionPairing).secret);
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

    if (peerConnectionRequest.type === PEER_CONNECTION_REQUEST_TYPE.PAIRING) {
        const trust = await Peers.peerConnectionRequestPairingDialog(peerConnectionRequest.peer.name, peerConnectionRequest.validation)
        if (!trust) {
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

        console.log(await decrypt(peerConnectionRequest.secret, peerConnectionRequest.key));

        // const peerTrusted: PeerTrusted = {
        //     ...peerConnectionRequest.peer,
        //     keys: {
        //         decrypt: peerConnectionRequest.key,
        //         encrypt: crypto.randomUUID()
        //     },
        //     secret: {
        //         their: ,
        //         own: crypto.randomUUID()
        //     }
        // }



    }
}

export default connectivityAPI;

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
}

// for large strings, use this from https://stackoverflow.com/a/49124600
const buff_to_base64 = (buff) => btoa(
    new Uint8Array(buff).reduce(
        (data, byte) => data + String.fromCharCode(byte), ''
    )
);

const base64_to_buf = (b64) =>
    Uint8Array.from(atob(b64), (c) => c.charCodeAt(null));

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

async function encrypt(data: string, key: string) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const cryptoKey = await importKey(key);
    const derivedKey = await deriveKey(cryptoKey, salt, "encrypt");
    const encryptedContent = await window.crypto.subtle.encrypt(
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
    return buff_to_base64(buff);
}

async function decrypt(base64: string, key: string) {
    const encryptedDataBuff = base64_to_buf(base64);
    const salt = encryptedDataBuff.slice(0, 16);
    const iv = encryptedDataBuff.slice(16, 16 + 12);
    const data = encryptedDataBuff.slice(16 + 12);
    const cryptoKey = await importKey(key);
    const derivedKey = await deriveKey(cryptoKey, salt, "decrypt");
    const decryptedContent = await window.crypto.subtle.decrypt(
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

const deriveKey = (cryptoKey: CryptoKey, salt: ArrayBufferLike, keyUsage: "encrypt" | "decrypt") => window.crypto.subtle.deriveKey(
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