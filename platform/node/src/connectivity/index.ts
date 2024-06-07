import type { InstanceEditor as InstanceEditorNode } from "../instanceEditor";
import type { InstanceEditor as InstanceEditorElectron } from "../../../electron/src/instanceEditor";
import { Bonjour } from "./bonjour";
import { WebSocketServer } from "./websocketServer";
import { PEER_CONNECTION_TYPE } from "../../../../src/connectivity/types";

export function initConnectivity(
    instanceEditor: InstanceEditorNode | InstanceEditorElectron
) {
    instanceEditor.wsServer = new WebSocketServer();

    instanceEditor.bonjour = new Bonjour(instanceEditor.wsServer);
    instanceEditor.bonjour.onPeerNearby = (eventType, peerNearby) => {
        instanceEditor.push("peerNearby", JSON.stringify({ eventType, peerNearby }));
    };

    instanceEditor.wsServer.onPeerConnectionLost = (id) => {
        instanceEditor.push("peerConnectionLost", JSON.stringify({ id }));
    };
    instanceEditor.wsServer.onPeerConnectionRequest = (
        id,
        peerConnectionRequestStr
    ) => {
        instanceEditor.push(
            "peerConnectionRequest",
            JSON.stringify({
                id,
                type: PEER_CONNECTION_TYPE.WEB_SOCKET_SERVER,
                peerConnectionRequestStr
            })
        );
    };
    instanceEditor.wsServer.onPeerData = (id, data) => {
        instanceEditor.push("peerData", JSON.stringify({ id, data }));
    };
}
