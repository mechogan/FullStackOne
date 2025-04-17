import { bridge } from "../bridge";

// 20
export function connect() {
    const payload = new Uint8Array([
        20
    ]);
    return bridge(payload);
}