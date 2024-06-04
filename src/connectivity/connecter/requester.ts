import { Connecter } from ".";

export abstract class ConnecterRequester extends Connecter {
    onOpenConnection: (id: string) => void;
    onPeerConnectionResponse: (id: string, peerConnectionRequestStr: string) => void;
    abstract open(id: string, ...args: any): void;
    abstract requestConnection(id: string, peerConnectionRequestStr: string): void;
    abstract trustConnection(id: string): void;
}