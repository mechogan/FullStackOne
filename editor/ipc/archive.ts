import ipc from "../../src";
import { serializeArgs } from "../../src/serialization";
import { Project } from "../types";

export const archive = {
    zip,
    unzip
};

// 30
function unzip(destination: string, data: Uint8Array) {
    const payload = new Uint8Array([30, ...serializeArgs([destination, data])]);

    return ipc.bridge(payload, ([success]) => success);
}

// 31
function zip(project: Project): Promise<Uint8Array> {
    const payload = new Uint8Array([31, ...serializeArgs([project.id])]);

    return ipc.bridge(payload, ([zipData]) => zipData);
}
