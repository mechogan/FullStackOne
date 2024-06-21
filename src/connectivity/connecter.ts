import { PEER_CONNECTION_TYPE } from "./types";

export abstract class Connecter {
    connections: { id: string; trusted: boolean }[];
    onPeerData: (id: string, data: string) => void;
    onPeerConnection: (id: string, type: PEER_CONNECTION_TYPE, state: "open" | "close") => void;

    abstract open(id: string, ...args: any): void;
    abstract trustConnection(id: string): void;
    abstract disconnect(id: string): void;
    abstract send(id: string, data: string, pairing: boolean): void;
}
