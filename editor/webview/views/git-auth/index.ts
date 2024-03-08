import "./index.css";

import type typeRPC from "../../../../src/webview";
import type api from "../../../api";

declare var rpc: typeof typeRPC<typeof api>;

export class GitAuth {
    receivedMessage(rawMessage: string){
        const message = JSON.parse(rawMessage);

        if(!message.hostname) return;

        const dialog = document.createElement("div");
        dialog.classList.add("dialog", "git-auth");

        const container = document.createElement("div");

        const text = document.createElement("p");
        text.innerHTML = `Authenticate for <b>${message.hostname}<b>`;
        container.append(text);

        const form = document.createElement("form");

        const usernameLabel = document.createElement("label");
        usernameLabel.innerText = "Username";
        form.append(usernameLabel);

        const usernameInput = document.createElement("input");
        form.append(usernameInput);

        const passwordLabel = document.createElement("label");
        passwordLabel.innerText = "Password";
        form.append(passwordLabel);

        const passwordInput = document.createElement("input");
        passwordInput.type = "password";
        form.append(passwordInput);

        const buttonGroup = document.createElement("div");

        const cancelButton = document.createElement("button");
        cancelButton.classList.add("text");
        cancelButton.innerText = "Cancel";
        buttonGroup.append(cancelButton);

        const authenticateButton = document.createElement("button");
        authenticateButton.innerText = "Authenticate";
        buttonGroup.append(authenticateButton);

        form.addEventListener("submit", async e => {
            e.preventDefault();

            await rpc().git.auth(message.hostname, usernameInput.value, passwordInput.value);
            dialog.remove();
        });

        form.append(buttonGroup);

        container.append(form);

        dialog.append(container);

        document.body.append(dialog);
    }
}