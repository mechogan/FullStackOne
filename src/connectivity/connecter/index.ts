export abstract class Connecter {
    connections: { id: string; trusted: boolean }[];
    onPeerData: (id: string, data: string) => void;
    onPeerConnectionLost: (id: string) => void;

    abstract disconnect(id: string): void;
    abstract send(id: string, data: string): void;
}
