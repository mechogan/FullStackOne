import { bridge } from "../../../lib/bridge";
import { serializeArgs } from "../../../lib/bridge/serialization";
import { Project } from "../../types";

// 30
export function unzip(destination: string, data: Uint8Array) {
    const payload = new Uint8Array([30, ...serializeArgs([destination, data])]);

    return bridge(payload, ([success]) => success);
}

// 31
export function zip(project: Project): Promise<Uint8Array> {
    const payload = new Uint8Array([31, ...serializeArgs([project.id])]);

    return bridge(payload, ([zipData]) => zipData);
}
