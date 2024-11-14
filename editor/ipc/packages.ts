import { ipcEditor } from ".";
import ipc from "../../src";
import { serializeArgs } from "../../src/serialization";

export const packages = {
    install
};

// 60
function install(packageName: string) {
    packageName = parsePackageName(packageName);
    const payload = new Uint8Array([60, ...serializeArgs([packageName])]);

    ipc.bridge(payload);
}

function parsePackageName(packageName: string) {
    const packageNameComponents = packageName.split("/");
    // @some/package
    if (packageNameComponents.at(0).startsWith("@")) {
        return packageNameComponents.slice(0, 2).join("/");
    }
    // react-dom/client
    else {
        return packageNameComponents.at(0);
    }
}
