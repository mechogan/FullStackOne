export type Peer = {
    id: string,
    name: string,
}

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

export enum PEER_ADVERSTISING_METHOD {
    UNKNOWN = 0,
    BONJOUR = 1,
    IOS_MULTIPEER = 2
}

export type PeerNearbyBonjour = {
    peer: Peer,
    type: PEER_ADVERSTISING_METHOD.BONJOUR,
    addresses: string[],
    port: number
}

export type PeerNearbyIOSMultiPeer = {
    id: string,
    peer: Peer,
    type: PEER_ADVERSTISING_METHOD.IOS_MULTIPEER
}

export type PeerNearby = PeerNearbyBonjour | PeerNearbyIOSMultiPeer

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

type PeerConnectionCommon = {
    id: string,
    type: PEER_CONNECTION_TYPE
}

export type PeerConnectionUntrusted = PeerConnectionCommon & {
    peer: Peer,
    state: PEER_CONNECTION_STATE.UNTRUSTED | PEER_CONNECTION_STATE.NOT_CONNECTED
}

export type PeerConnectionPairing = PeerConnectionCommon & Omit<PeerConnectionRequestPairing, "request_type"> & {
    state: PEER_CONNECTION_STATE.PAIRING
}

export type PeerConnectionTrusted = PeerConnectionCommon & {
    peer: PeerTrusted,
    state: PEER_CONNECTION_STATE.CONNECTED
}

export type PeerConnection = PeerConnectionUntrusted | PeerConnectionPairing | PeerConnectionTrusted

export enum PEER_CONNECTION_REQUEST_TYPE {
    PAIRING = 0,
    TRUSTED = 1
}

export type PeerConnectionRequestCommon = {
    peer: Peer,
    secret: string,
    request_type: PEER_CONNECTION_REQUEST_TYPE,
}

export type PeerConnectionRequestPairing = PeerConnectionRequestCommon & {
    request_type: PEER_CONNECTION_REQUEST_TYPE.PAIRING,
    validation: number,
    key: string
}

export type PeerConnectionRequest = PeerConnectionRequestCommon | PeerConnectionRequestPairing

export type PeerData = {
    peerConnection: PeerConnectionTrusted,
    data: string
}