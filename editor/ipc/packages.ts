import ipc from "../../src";
import { serializeArgs } from "../../src/serialization";
import { parsePackageName } from "../typescript/utils";

export const packages = {
    install
};

// 60
function install(packageName: string) {
    packageName = parsePackageName(packageName);
    const payload = new Uint8Array([60, ...serializeArgs([packageName])]);

    ipc.bridge(payload);
}
