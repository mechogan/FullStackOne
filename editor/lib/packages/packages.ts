import { bridge } from "../../../lib/bridge";
import { serializeArgs } from "../../../lib/bridge/serialization";
import { parsePackageName } from "../../typescript/utils";

// 60
export function install(packageName: string) {
    packageName = parsePackageName(packageName);
    const payload = new Uint8Array([60, ...serializeArgs([packageName])]);

    bridge(payload);
}
