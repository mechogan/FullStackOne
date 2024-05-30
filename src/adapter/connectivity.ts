export type Peer = {
    id: string,
    name: string,
}

export enum PEER_ADVERSTISING_METHOD {
    UNKNOWN = 0,
    BONJOUR = 1,
    IOS_MULTIPEER = 2
}

export type PeerNearbyBonjour = Peer & {
    type: PEER_ADVERSTISING_METHOD.BONJOUR,
    addresses: string[],
    port: number
}

export type PeerNearbyIOSMultiPeer = Peer & {
    type: PEER_ADVERSTISING_METHOD.IOS_MULTIPEER
}

export type PeerNearby = PeerNearbyBonjour | PeerNearbyIOSMultiPeer

export type PeerTrusted = Peer & {
    secret: {
        own: string,
        their: string
    },
    keys: {
        encrypt: string,
        decrypt: string
    }
}

export enum PEER_CONNECTION_TYPE {
    UNKNOWN = 0,
    WEB_SOCKET = 1,
    WEB_SOCKET_SERVER = 2,
    IOS_MULTIPEER = 3
}

export enum PEER_CONNECTION_STATE {
    NOT_CONNECTED = 0,
    PAIRING = 1,
    UNTRUSTED = 2,
    CONNECTED = 3
}

export type PeerConnectionPairing = Peer & {
    type: PEER_CONNECTION_TYPE,
    state: PEER_CONNECTION_STATE.PAIRING,
    validation: number,
    secret: string,
    key: string
}

export type PeerConnection = PeerConnectionPairing | (PeerTrusted & {
    type: PEER_CONNECTION_TYPE,
    state: PEER_CONNECTION_STATE
});