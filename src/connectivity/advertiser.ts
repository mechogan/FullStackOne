import { Peer } from "./types";

export abstract class Advertiser {
    abstract startAdvertising(me: Peer): void;
    abstract stopAdvertising(): void;
}
