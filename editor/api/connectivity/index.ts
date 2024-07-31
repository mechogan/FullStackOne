import config from "../config";
import { CONFIG_TYPE } from "../config/types";
import rpc from "../../rpc";
import api from "..";
import { ConnectWebSocket } from "./websocket";
import {
    PEER_ADVERSTISING_METHOD,
    PEER_CONNECTION_PAIRING_DATA_TYPE,
    PEER_CONNECTION_STATE,
    PEER_CONNECTION_TYPE,
    Peer,
    PeerConnection,
    PeerConnectionPairing,
    PeerConnectionRequest,
    PeerConnectionTokenChallenge,
    PeerConnectionTokenExchange,
    PeerConnectionTrusted,
    PeerConnectionUntrusted,
    PeerMessage,
    PeerNearby,
    PeerNearbyBonjour,
    PeerNearbyWeb,
    PeerTrusted,
    WebAddress
} from "../../../src/connectivity/types";
import { decrypt, encrypt, generateHash } from "./cryptoUtils";
import peers from "../../views/peers";
import { BrowseWeb, constructURL } from "./web";

let me: Peer,
    autoConnect = false;
let advertiseTimeout: ReturnType<typeof setTimeout>;

const peersConnections = new Map<string, PeerConnection>();

const connecterWebSocket = new ConnectWebSocket();
connecterWebSocket.onPeerConnection = onPeerConnection;
connecterWebSocket.onPeerData = onPeerData;

const browserWeb = new BrowseWeb();
browserWeb.onPeerNearby = onPeerNearby;

onPush["peerNearby"] = async (eventStr) => {
    const event = JSON.parse(eventStr);

    const eventType: "new" | "lost" = event.eventType;
    const peerNearby: PeerNearby = event.peerNearby;

    onPeerNearby(eventType, peerNearby);
};

async function onPeerNearby(eventType: "new" | "lost", peerNearby: PeerNearby) {
    if (eventType === "new" && autoConnect) {
        let alreadyConnected = false;
        // already connected
        for (const peerConection of peersConnections.values()) {
            if (peerConection.peer.id === peerNearby.peer.id) {
                alreadyConnected = true;
                break;
            }
        }

        // if trusted, connect
        const peerTrusted = await connectivityAPI.peers.trusted();
        if (
            !alreadyConnected &&
            peerTrusted.find(({ id }) => id === peerNearby.peer.id)
        ) {
            connectivityAPI.connect(peerNearby);
        }
    }

    onPush["peerConnectivityEvent"](null);
}

const verifyWSS = async (peerNearby: PeerNearbyBonjour | PeerNearbyWeb) => {
    const addresses =
        peerNearby.type === PEER_ADVERSTISING_METHOD.BONJOUR
            ? peerNearby.addresses.map(
                  (hostname) =>
                      ({
                          hostname,
                          port: peerNearby.port,
                          secure: false
                      }) as WebAddress
              )
            : [peerNearby.address];

    let alive = false;
    for (const address of addresses) {
        const url = constructURL(address, "http") + "/ping";

        const response = await new Promise((resolve) => {
            rpc()
                .fetch(url, {
                    encoding: "utf8",
                    timeout: 500
                })
                .then((res) => resolve(res.body))
                .catch(() => resolve(null));
        });

        alive = response === "pong";
        if (alive) return true;
    }

    api.connectivity.browse.peerNearbyIsDead(peerNearby);
    return false;
};

const connectivityAPI = {
    async init() {
        let connectivityConfig = await config.load(CONFIG_TYPE.CONNECTIVITY);
        if (!connectivityConfig || typeof connectivityConfig.me === "string") {
            connectivityConfig = {
                me: {
                    id: crypto.randomUUID(),
                    name: await rpc().connectivity.name()
                },
                autoConnect: false,
                defaultNetworkInterface: null,
                webAddreses: [],
                peersTrusted: []
            };
            await config.save(CONFIG_TYPE.CONNECTIVITY, connectivityConfig);
        }

        me = connectivityConfig.me;
        autoConnect = connectivityConfig.autoConnect;

        if (autoConnect) {
            connectivityAPI.advertise.start();
            connectivityAPI.browse.start();
        } else {
            connectivityAPI.advertise.stop();
            connectivityAPI.browse.stop();
        }
    },
    peers: {
        async trusted() {
            return (await config.load(CONFIG_TYPE.CONNECTIVITY)).peersTrusted;
        },
        async connections() {
            return Array.from(peersConnections.values());
        },
        async nearby() {
            const seenPeerID = new Set<string>();
            const peersNearby = [
                (await rpc().connectivity.peers.nearby()) || [],
                browserWeb.getPeersNearby()
            ]
                .flat()
                .filter(({ peer: { id } }) => {
                    if (id === me.id || seenPeerID.has(id)) return false;
                    seenPeerID.add(id);
                    return true;
                });

            const verificationPromises: {
                promise: Promise<boolean>;
                peerID: string;
            }[] = [];
            for (const peerNearby of peersNearby) {
                if (
                    peerNearby.type === PEER_ADVERSTISING_METHOD.WEB ||
                    peerNearby.type === PEER_ADVERSTISING_METHOD.BONJOUR
                ) {
                    verificationPromises.push({
                        promise: verifyWSS(peerNearby),
                        peerID: peerNearby.peer.id
                    });
                }
            }

            const verifications = await Promise.all(
                verificationPromises.map(({ promise }) => promise)
            );
            verifications.forEach((alive, index) => {
                const { peerID } = verificationPromises[index];
                if (!alive) {
                    const indexOf = peersNearby.findIndex(
                        ({ peer: { id } }) => id === peerID
                    );
                    peersNearby.splice(indexOf, 1);
                }
            });

            return peersNearby;
        }
    },
    browse: {
        start() {
            browserWeb.startBrowsing();
            rpc().connectivity.browse.start();
        },
        peerNearbyIsDead(peerNearby: PeerNearbyBonjour | PeerNearbyWeb) {
            browserWeb.peerNearbyIsDead(peerNearby.peer.id);
            rpc().connectivity.browse.peerNearbyIsDead(peerNearby.peer.id);
        },
        stop() {
            browserWeb.stopBrowsing();
            rpc().connectivity.browse.stop();
        }
    },
    advertise: {
        async start(forMS = 5000) {
            if (advertiseTimeout) clearTimeout(advertiseTimeout);

            let connectivityConfig = await config.load(
                CONFIG_TYPE.CONNECTIVITY
            );
            rpc().connectivity.advertise.start(
                me,
                connectivityConfig.defaultNetworkInterface
            );

            if (!autoConnect) {
                advertiseTimeout = setTimeout(() => {
                    rpc()
                        .connectivity.advertise.stop()
                        .then(() => (advertiseTimeout = undefined));
                }, forMS);
            }
        },
        stop() {
            rpc().connectivity.advertise.stop();
        }
    },
    async connect(peerNearby: PeerNearby) {
        for (const peerConnection of peersConnections.values()) {
            // already connected or in the process of connecting
            if (peerConnection.peer?.id === peerNearby.peer?.id) return;
        }

        let id: string;
        switch (peerNearby.type) {
            case PEER_ADVERSTISING_METHOD.WEB:
            case PEER_ADVERSTISING_METHOD.BONJOUR:
                const alive = await verifyWSS(peerNearby);
                if (!alive) return;
                id = crypto.randomUUID();
                connecterWebSocket.open(id, peerNearby);
                break;
            case PEER_ADVERSTISING_METHOD.IOS_MULTIPEER:
                id = peerNearby.id;
                rpc().connectivity.open(peerNearby.id, me);
                break;
        }

        peersConnections.set(id, {
            id,
            state: PEER_CONNECTION_STATE.NOT_CONNECTED,
            peer: peerNearby.peer,
            type: null
        });
    },
    async forget(peerTrusted: PeerTrusted) {
        const connectivityConfig = await api.config.load(
            CONFIG_TYPE.CONNECTIVITY
        );
        const indexOf = connectivityConfig.peersTrusted.findIndex(
            ({ id }) => id === peerTrusted.id
        );
        if (indexOf <= -1) return;
        connectivityConfig.peersTrusted.splice(indexOf, 1);
        await api.config.save(CONFIG_TYPE.CONNECTIVITY, connectivityConfig);
    },
    async disconnect(peerConnection: PeerConnection) {
        peersConnections.delete(peerConnection.id);

        switch (peerConnection.type) {
            case PEER_CONNECTION_TYPE.IOS_MULTIPEER:
            case PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER:
                await rpc().connectivity.disconnect(peerConnection.id);
                break;
            case PEER_CONNECTION_TYPE.WEB_SOCKET:
                connecterWebSocket.disconnect(peerConnection.id);
                break;
        }

        onPush["peerConnectivityEvent"](null);
        onPush["peerConnectionsCount"](null);
    }
};

export default connectivityAPI;

async function savePeerTrusted(peerTrusted: PeerTrusted) {
    const connectivityConfig = await api.config.load(CONFIG_TYPE.CONNECTIVITY);

    const indexOf = connectivityConfig.peersTrusted.findIndex(
        ({ id }) => id === peerTrusted.id
    );
    if (indexOf === -1) {
        connectivityConfig.peersTrusted.push(peerTrusted);
    } else {
        connectivityConfig.peersTrusted[indexOf] = peerTrusted;
    }

    await api.config.save(CONFIG_TYPE.CONNECTIVITY, connectivityConfig);
}

onPush["peerConnection"] = (eventStr: string) => {
    const event = JSON.parse(eventStr);

    const id: string = event.id;
    const type = event.type;
    const state = event.state;

    onPeerConnection(id, type, state);
};

async function onPeerConnection(
    id: string,
    type: PEER_CONNECTION_TYPE,
    state: "open" | "close"
) {
    console.log(`onPeerConnection [${state}]`);

    if (state === "close") {
        const connection = peersConnections.get(id);
        if (connection) {
            peersConnections.delete(id);

            const [peersNearby, peersTrusted] = await Promise.all([
                api.connectivity.peers.nearby(),
                api.connectivity.peers.trusted()
            ]);

            const peerNearby = peersNearby.find(
                ({ peer: { id } }) => id === connection.peer.id
            );
            const peerTrusted = peersTrusted.find(
                ({ id }) => id === connection.peer.id
            );

            // if trusted peer is still nearby, reconnect
            if (peerNearby && peerTrusted) {
                api.connectivity.connect(peerNearby);
            }
        }
    } else {
        const peerConnection = peersConnections.get(id);

        // wait for connection request
        // TODO: disconnect after 10s
        if (!peerConnection) {
            peersConnections.set(id, {
                id,
                type,
                state: PEER_CONNECTION_STATE.NOT_CONNECTED
            });
        }
        // we opened the connection, so lets request trust
        else {
            peerConnection.type = type;
            await sendPeerConnectionRequest(peerConnection);
        }
    }

    onPush["peerConnectivityEvent"](null);
    onPush["peerConnectionsCount"](null);
}

async function sendPeerConnectionRequest(peerConnection: PeerConnection) {
    console.log("sendPeerConnectionRequest");

    const validation = randomIntFromInterval(1000, 9999);
    const peerConnectionRequest: PeerConnectionRequest = {
        type: PEER_CONNECTION_PAIRING_DATA_TYPE.REQUEST,
        peer: me,
        validation
    };

    const peerConectionPairing = peerConnection as PeerConnectionPairing;
    peerConectionPairing.state = PEER_CONNECTION_STATE.PAIRING;
    peerConectionPairing.validation = validation;

    return sendData(
        peerConnection,
        null,
        JSON.stringify(peerConnectionRequest),
        true
    );
}

async function onPeerConnectionPairingData(
    peerConnection: PeerConnection,
    data: string
) {
    console.log("onPeerConnectionPairingData");

    let payload:
        | PeerConnectionRequest
        | PeerConnectionTokenExchange
        | PeerConnectionTokenChallenge;
    try {
        payload = JSON.parse(data);
    } catch (e) {
        console.log("Failed to parse data for peer connection");
        console.log(data);
        return connectivityAPI.disconnect(peerConnection);
    }

    switch (payload.type) {
        case PEER_CONNECTION_PAIRING_DATA_TYPE.REQUEST:
            await respondToPeerConnectionRequest(peerConnection, payload);
            break;
        case PEER_CONNECTION_PAIRING_DATA_TYPE.TOKEN_EXCHANGE:
            await respondToReceivedTokenExchange(
                peerConnection as PeerConnectionPairing,
                payload
            );
            break;
        case PEER_CONNECTION_PAIRING_DATA_TYPE.TOKEN_CHALLENGE:
            if (
                !(peerConnection?.peer as PeerTrusted)?.keys ||
                !(peerConnection?.peer as PeerTrusted)?.secret
            ) {
                const trustedPeer = (
                    await connectivityAPI.peers.trusted()
                ).find(({ id }) => id === payload.peer.id);
                if (trustedPeer) {
                    peerConnection.state = PEER_CONNECTION_STATE.UNTRUSTED;
                    peerConnection.peer = trustedPeer;
                }
            }
            await respondToReceivedTokenChallenge(
                peerConnection as PeerConnectionUntrusted,
                payload
            );
            break;
    }

    onPush["peerConnectivityEvent"](null);
    onPush["peerConnectionsCount"](null);
}

async function respondToPeerConnectionRequest(
    peerConnection: PeerConnection,
    peerConnectionRequest: PeerConnectionRequest
) {
    console.log("respondToPeerConnectionRequest");

    const peer = peerConnectionRequest.peer;

    const trustedPeers = await connectivityAPI.peers.trusted();
    const knownPeer = trustedPeers.find(({ id }) => id === peer.id);

    // known and trusted peer
    if (knownPeer) {
        const peerConectionUntrusted =
            peerConnection as PeerConnectionUntrusted;
        peerConectionUntrusted.state = PEER_CONNECTION_STATE.UNTRUSTED;
        peerConectionUntrusted.peer = knownPeer;
        peerConectionUntrusted.validation = peerConnectionRequest.validation;
        return sendPeerConnectionTokenChallenge(
            peerConnection as PeerConnectionUntrusted
        );
    }

    // unknown connection request
    const trust = await peers.peerConnectionRequestPairingDialog(
        peer.name,
        peerConnectionRequest.validation
    );
    if (!trust) {
        return connectivityAPI.disconnect(peerConnection);
    }

    const peerConnectionPairing = peerConnection as PeerConnectionPairing;
    peerConnectionPairing.state = PEER_CONNECTION_STATE.PAIRING;
    peerConnectionPairing.validation = peerConnectionRequest.validation;
    peerConnectionPairing.peer = peer;
    return sendPeerConnectionTokenExchange(peerConnectionPairing);
}

async function sendPeerConnectionTokenExchange(
    peerConnection: PeerConnectionPairing
) {
    console.log("sendPeerConnectionTokenExchange");

    peerConnection.peer.keys = {
        decrypt: peerConnection.peer?.keys?.decrypt ?? undefined,
        encrypt: generateHash(32)
    };
    peerConnection.peer.secret = {
        their: peerConnection.peer?.secret?.their ?? undefined,
        own: generateHash(12)
    };

    const peerConnectionTokenExchange: PeerConnectionTokenExchange = {
        type: PEER_CONNECTION_PAIRING_DATA_TYPE.TOKEN_EXCHANGE,
        peer: me,
        secret: await encrypt(
            peerConnection.peer.secret.own,
            peerConnection.peer.keys.encrypt
        ),
        key: peerConnection.peer.keys.encrypt,
        validation: peerConnection.validation
    };

    return sendData(
        peerConnection,
        null,
        JSON.stringify(peerConnectionTokenExchange),
        true
    );
}

async function respondToReceivedTokenExchange(
    peerConnection: PeerConnectionPairing,
    tokenExchange: PeerConnectionTokenExchange
) {
    console.log("respondToReceivedTokenExchange");

    if (peerConnection.state !== PEER_CONNECTION_STATE.PAIRING) {
        console.log(
            "Received token exchange for a connection not in pairing state"
        );
        return connectivityAPI.disconnect(peerConnection);
    }

    if (peerConnection.validation !== tokenExchange.validation) {
        console.log("Received wrong validation code with token exchange");
        return connectivityAPI.disconnect(peerConnection);
    }

    // if we have an encrypt and a secret for peer,
    // it means we have exchange token in the past
    const knownPeer =
        peerConnection.peer?.keys?.encrypt && peerConnection.peer?.secret?.own;

    if (!knownPeer) {
        const trust = await peers.peerConnectionRequestPairingDialog(
            tokenExchange.peer.name,
            tokenExchange.validation
        );
        if (!trust) {
            return connectivityAPI.disconnect(peerConnection);
        }
    }

    peerConnection.peer = {
        ...tokenExchange.peer,
        keys: {
            encrypt: peerConnection.peer?.keys?.encrypt ?? undefined,
            decrypt: tokenExchange.key
        },
        secret: {
            own: peerConnection.peer?.secret?.own ?? undefined,
            their: await decrypt(tokenExchange.secret, tokenExchange.key)
        }
    };

    if (!knownPeer) {
        await sendPeerConnectionTokenExchange(peerConnection);
    }

    const peerConnectionUntrusted =
        peerConnection as unknown as PeerConnectionUntrusted;
    peerConnectionUntrusted.state = PEER_CONNECTION_STATE.UNTRUSTED;

    if (knownPeer) {
        return sendPeerConnectionTokenChallenge(peerConnectionUntrusted);
    }
}

async function sendPeerConnectionTokenChallenge(
    peerConection: PeerConnectionUntrusted
) {
    console.log("sendPeerConnectionTokenChallenge");

    const peerConnectionTokenChallenge: PeerConnectionTokenChallenge = {
        type: PEER_CONNECTION_PAIRING_DATA_TYPE.TOKEN_CHALLENGE,
        peer: me,
        validation: peerConection.validation,
        secret: await encrypt(
            peerConection.peer.secret.own,
            peerConection.peer.keys.encrypt
        )
    };

    await sendData(
        peerConection,
        null,
        JSON.stringify(peerConnectionTokenChallenge),
        true
    );

    peerConection.challenged = true;
}

async function respondToReceivedTokenChallenge(
    peerConnection: PeerConnectionUntrusted,
    tokenChallenge: PeerConnectionTokenChallenge
) {
    console.log("respondToReceivedTokenChallenge");

    if (peerConnection.state !== PEER_CONNECTION_STATE.UNTRUSTED) {
        console.log(
            "Received token challenge for a connection not in untrusted state"
        );
        return connectivityAPI.disconnect(peerConnection);
    }

    if (peerConnection.validation !== tokenChallenge.validation) {
        console.log("Received wrong validation code with token challenge");
        return connectivityAPI.disconnect(peerConnection);
    }

    const theirSecret = await decrypt(
        tokenChallenge.secret,
        peerConnection.peer.keys.decrypt
    );
    if (theirSecret !== peerConnection.peer.secret.their) {
        return connectivityAPI.disconnect(peerConnection);
    }

    if (!peerConnection.challenged) {
        await sendPeerConnectionTokenChallenge(peerConnection);
    }

    const peerConnectionTrusted =
        peerConnection as unknown as PeerConnectionTrusted;
    peerConnectionTrusted.state = PEER_CONNECTION_STATE.CONNECTED;
    await savePeerTrusted(peerConnectionTrusted.peer);
    return trustConnection(peerConnectionTrusted);
}

async function trustConnection(peerConnection: PeerConnectionTrusted) {
    console.log("trustConnection");

    switch (peerConnection.type) {
        case PEER_CONNECTION_TYPE.WEB_SOCKET:
            connecterWebSocket.trustConnection(peerConnection.id);
            break;
        case PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER:
        case PEER_CONNECTION_TYPE.IOS_MULTIPEER:
            await rpc().connectivity.trustConnection(peerConnection.id);
            break;
    }
}

onPush["peerData"] = (eventStr: string) => {
    const event = JSON.parse(eventStr);

    const id = event.id;
    const data = event.data;

    onPeerData(id, data);
};

async function onPeerData(id: string, messageStr: string) {
    const peerConnection = peersConnections.get(id);
    const peerMessage: PeerMessage = JSON.parse(messageStr);

    if (!peerConnection) {
        console.log("Received data from unknown connection...");
    } else if (peerConnection.state === PEER_CONNECTION_STATE.CONNECTED) {
        const data = peerMessage.encrypted
            ? await decrypt(peerMessage.data, peerConnection.peer.keys.decrypt)
            : peerMessage.data;
        rpc().connectivity.convey(peerMessage.projectId, data);
    } else {
        onPeerConnectionPairingData(peerConnection, peerMessage.data);
    }
}

onPush["sendData"] = (payload: string) => {
    const { projectId, data } = JSON.parse(payload);

    for (const peerConnection of peersConnections.values()) {
        sendData(peerConnection, projectId, data);
    }
};

async function sendData(
    peerConnection: PeerConnection,
    projectId: string,
    data: string,
    pairing = false
) {
    if (peerConnection.state !== PEER_CONNECTION_STATE.CONNECTED && !pairing)
        return;

    let payload: PeerMessage = {
        projectId,
        data:
            peerConnection.state === PEER_CONNECTION_STATE.CONNECTED
                ? await encrypt(data, peerConnection.peer.keys.encrypt)
                : data,
        encrypted: peerConnection.state === PEER_CONNECTION_STATE.CONNECTED
    };

    switch (peerConnection.type) {
        case PEER_CONNECTION_TYPE.WEB_SOCKET:
            connecterWebSocket.send(
                peerConnection.id,
                JSON.stringify(payload),
                pairing
            );
            break;
        case PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER:
        case PEER_CONNECTION_TYPE.IOS_MULTIPEER:
            rpc().connectivity.send(
                peerConnection.id,
                JSON.stringify(payload),
                pairing
            );
            break;
    }
}

function randomIntFromInterval(min, max) {
    // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
}
