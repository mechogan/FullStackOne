import { ipc } from "./ipc";
import { Platform } from "./platforms";
import { NodeBridge } from "./node-bridge";

const platform = await (await fetch("/platform")).text() as Platform;

switch (platform) {
    case Platform.NODE:
        ipc.bridge = NodeBridge
        break;
    case Platform.IOS:
    case Platform.ANDROID:
    case Platform.ELECTRON:
    case Platform.DOCKER:
    case Platform.WEBCONTAINER:
        console.log("Bridge not yet implemented")
}

globalThis.ipc = ipc.methods;