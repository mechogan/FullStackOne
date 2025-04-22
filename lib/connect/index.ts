import { bridge } from "../bridge";
import { serializeArgs } from "../bridge/serialization";

// 20
export function connect() {
    const payload = new Uint8Array([
        20
    ]);
    const transformer = ([channelId]) => channelId;
    return bridge(payload, transformer);
}

// 21
export function send(channelId: string) {
    const payload = new Uint8Array([
        21,
        ...serializeArgs([channelId])
    ]);
    return bridge(payload);
}