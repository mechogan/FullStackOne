import { PeerNearby } from "./types";

export abstract class Browser {
    onPeerNearby: (eventType: "new" | "lost", peerNearby: PeerNearby) => void;

    abstract getPeersNearby(): PeerNearby[];
    abstract startBrowsing(): void;
    abstract stopBrowsing(): void;
    abstract peerNearbyIsDead(id: string): void;
}
