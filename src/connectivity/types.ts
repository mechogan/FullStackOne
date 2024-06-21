export type Peer = {
    id: string;
    name: string;
};

export type PeerTrusted = Peer & {
    secret: {
        own: string;
        their: string;
    };
    keys: {
        encrypt: string;
        decrypt: string;
    };
};

export enum PEER_ADVERSTISING_METHOD {
    UNKNOWN = 0,
    BONJOUR = 1,
    IOS_MULTIPEER = 2,
    WEB = 3
}

export type WebAddress = {
    hostname: string,
    port: number,
    secure: boolean
}

export type PeerNearbyWeb = {
    type: PEER_ADVERSTISING_METHOD.WEB;
    peer: Peer;
    address: WebAddress;
}

export type PeerNearbyBonjour = {
    type: PEER_ADVERSTISING_METHOD.BONJOUR;
    peer: Peer;
    addresses: string[];
    port: number;
};

export type PeerNearbyIOSMultiPeer = {
    type: PEER_ADVERSTISING_METHOD.IOS_MULTIPEER;
    id: string;
    peer: Peer;
};

export type PeerNearby = PeerNearbyBonjour | PeerNearbyIOSMultiPeer | PeerNearbyWeb;

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
    id: string;
    type: PEER_CONNECTION_TYPE;
    state: PEER_CONNECTION_STATE;
};

export type PeerConnectionNotConnected = PeerConnectionCommon & {
    peer?: Peer;
    state: PEER_CONNECTION_STATE.NOT_CONNECTED;
};

type RecursivePartial<T> = {
    [P in keyof T]?: RecursivePartial<T[P]>;
};

export type PeerConnectionPairing = PeerConnectionCommon & {
    peer: RecursivePartial<PeerTrusted>;
    state: PEER_CONNECTION_STATE.PAIRING;
    validation: number;
};

export type PeerConnectionUntrusted = PeerConnectionCommon & {
    peer: PeerTrusted;
    state: PEER_CONNECTION_STATE.UNTRUSTED;
    challenged: boolean;
    validation: number;
};

export type PeerConnectionTrusted = PeerConnectionCommon & {
    peer: PeerTrusted;
    state: PEER_CONNECTION_STATE.CONNECTED;
    validation: number;
};

export type PeerConnection =
    PeerConnectionNotConnected
    | PeerConnectionUntrusted
    | PeerConnectionPairing
    | PeerConnectionTrusted;

export enum PEER_CONNECTION_PAIRING_DATA_TYPE {
    REQUEST,
    TOKEN_EXCHANGE,
    TOKEN_CHALLENGE,
    ACCEPTED
}

export type PeerConnectionRequest = {
    type: PEER_CONNECTION_PAIRING_DATA_TYPE.REQUEST,
    peer: Peer,
    validation: number
}

export type PeerConnectionTokenExchange = Omit<PeerConnectionRequest, "type"> & {
    type: PEER_CONNECTION_PAIRING_DATA_TYPE.TOKEN_EXCHANGE,
    secret: string,
    key: string
}

export type PeerConnectionTokenChallenge = Omit<PeerConnectionRequest, "type"> & {
    type: PEER_CONNECTION_PAIRING_DATA_TYPE.TOKEN_CHALLENGE,
    secret: string
}

export type PeerData = {
    peerConnection: PeerConnectionTrusted;
    data: string;
};
