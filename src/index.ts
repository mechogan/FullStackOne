import { ipc } from "./ipc";
import { Platform } from "./platforms";
import { BridgeNode, initCallbackNode } from "./bridge/node";
import { BridgeIOS } from "./bridge/ios";
import { BridgeAndroid } from "./bridge/android";
import { BridgeWasm } from "./bridge/wasm";
import { BridgeWindows } from "./bridge/windows";

const platform = (await (await fetch("/platform")).text()) as Platform;

switch (platform) {
    case Platform.DOCKER:
    case Platform.NODE:
        ipc.bridge = BridgeNode;
        initCallbackNode();
        break;
    case Platform.IOS:
        ipc.bridge = BridgeIOS;
        break;
    case Platform.ANDROID:
        ipc.bridge = BridgeAndroid;
        break;
    case Platform.WASM:
        ipc.bridge = BridgeWasm;
        break;
    case Platform.WINDOWS:
        ipc.bridge = BridgeWindows;
        break;
    case Platform.ELECTRON:
        console.log("Bridge not yet implemented");
}

globalThis.ipc = ipc.methods;

export default ipc;

(globalThis as any).onmessage = (message: string) => {
    console.log(message)
};
