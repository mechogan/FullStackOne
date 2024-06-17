import { Adapter } from "../../../src/adapter/fullstacked";

export abstract class Instance {
    abstract adapter: Adapter;
    abstract push(messageType: string, message: string): void;
    abstract restart(): void;
    abstract start(): void;
}