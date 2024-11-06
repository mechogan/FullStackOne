import { ipc } from "./ipc";
import { Platform } from "./platforms";
import { BridgeNode } from "./bridge/node";
import { BridgeIOS } from "./bridge/ios";

const platform = (await (await fetch("/platform")).text()) as Platform;

switch (platform) {
    case Platform.NODE:
        ipc.bridge = BridgeNode;
        break;
    case Platform.IOS:
        ipc.bridge = BridgeIOS;
        break;
    case Platform.ANDROID:
    case Platform.ELECTRON:
    case Platform.DOCKER:
    case Platform.WEBCONTAINER:
    case Platform.WINDOWS:
        console.log("Bridge not yet implemented");
}

globalThis.ipc = ipc.methods;

export default ipc;
