import { Connecter } from ".";

export abstract class ConnecterResponder extends Connecter {
    onPeerConnectionRequest: (
        id: string,
        peerConnectionRequestStr: string
    ) => void;
    abstract respondToConnectionRequest(
        id: string,
        peerConnectionResponseStr: string
    ): void;
}
