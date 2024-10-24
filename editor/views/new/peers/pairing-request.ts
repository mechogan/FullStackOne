import {
    PeerConnectionRequest,
    PeerConnectionTokenExchange
} from "../../../../src/connectivity/types";
import { Dialog } from "../../../components/dialog";
import { Button } from "../../../components/primitives/button";

type PairingRequestOpts = {
    peerConnectionRequest: PeerConnectionRequest | PeerConnectionTokenExchange;
};

export function PairingRequest(opts: PairingRequestOpts) {
    const container = document.createElement("div");
    container.classList.add("pairing-request");

    container.innerHTML = `
        <h3>Pairing Request</h3>
        <p><b>${opts.peerConnectionRequest.peer.name}</b> is trying to pair with you.</p>
        <p>Make sure you recognize this request and validate with the following code</p>
        <code>${opts.peerConnectionRequest.validation}</code>
    `;

    const buttonRow = document.createElement("div");

    const denyButton = Button({
        text: "Deny",
        color: "red"
    });
    const trustButton = Button({
        text: "Trust"
    });

    buttonRow.append(denyButton, trustButton);

    container.append(buttonRow);

    const { remove } = Dialog(container);

    return new Promise<boolean>((resolve) => {
        trustButton.onclick = () => {
            resolve(true);
            remove();
        };
        denyButton.onclick = () => {
            resolve(false);
            remove();
        };
    });
}
