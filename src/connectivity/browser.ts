import { PeerNearby } from "./types";

export abstract class Browser {
    onPeerNearby: (eventType: "new" | "lost") => void;

    abstract getPeersNearby(): PeerNearby[];
    abstract startBrowsing(): void;
    abstract stopBrowsing(): void;
}
