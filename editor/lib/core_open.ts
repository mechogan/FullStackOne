import { bridge } from "../../lib/bridge";
import { serializeArgs } from "../../lib/bridge/serialization";

// 100
export default function core_open(projectId: string) {
    const payload = new Uint8Array([100, ...serializeArgs([projectId])]);

    return bridge(payload);
}
