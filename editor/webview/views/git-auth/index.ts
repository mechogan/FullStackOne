import "./index.css";

import type typeRPC from "../../../../src/webview";
import type api from "../../../api";

declare var rpc: typeof typeRPC<typeof api>;

export class GitAuth {
    static async renderGitAuthForm(
        done: () => void,
        auth?: {
            host?: string;
            username?: string;
            email?: string;
        },
        create = true
    ) {
        const form = document.createElement("form");
        form.classList.add("git-form");

        let hostnameInput: HTMLInputElement;
        if (!auth?.host) {
            const hostLabel = document.createElement("label");
            hostLabel.innerText = "Hostname";
            form.append(hostLabel);

            hostnameInput = document.createElement("input");
            form.append(hostnameInput);
        }

        const usernameLabel = document.createElement("label");
        usernameLabel.innerText = "Username";
        form.append(usernameLabel);

        const usernameInput = document.createElement("input");
        usernameInput.value = auth?.username || "";
        form.append(usernameInput);

        const emailInputLabel = document.createElement("label");
        emailInputLabel.innerText = "Email (optional)";
        form.append(emailInputLabel);

        const emailInput = document.createElement("input");
        emailInput.type = "email";
        emailInput.value = auth?.email || "";
        form.append(emailInput);

        const passwordLabel = document.createElement("label");
        passwordLabel.innerText = "Password";
        form.append(passwordLabel);

        let passwordInput: HTMLInputElement;
        if (create) {
            passwordInput = document.createElement("input");
            passwordInput.type = "password";
            form.append(passwordInput);
        } else {
            const div = document.createElement("div");
            div.innerText = "To change password, delete and re-create.";
            form.append(div);
        }

        const buttonGroup = document.createElement("div");

        const confirmButton = document.createElement("button");
        confirmButton.classList.add("text");
        confirmButton.innerHTML = await (
            await fetch("assets/icons/check.svg")
        ).text();
        buttonGroup.append(confirmButton);

        const cancelButton = document.createElement("button");
        cancelButton.classList.add("text", "danger");
        cancelButton.innerHTML = await (
            await fetch("assets/icons/close.svg")
        ).text();
        cancelButton.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            done();
        });
        buttonGroup.append(cancelButton);

        form.append(buttonGroup);

        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            await rpc().git.auth(
                auth?.host || hostnameInput.value,
                usernameInput.value,
                emailInput.value,
                passwordInput?.value
            );

            done();
        });

        return form;
    }

    async receivedMessage(rawMessage: string) {
        const message = JSON.parse(rawMessage);

        if (!message.hostname) return;

        const dialog = document.createElement("div");
        dialog.classList.add("dialog", "git-auth");

        const container = document.createElement("div");

        const text = document.createElement("p");
        text.innerHTML = `Authenticate for <b>${message.hostname}<b>`;
        container.append(text);

        container.append(
            await GitAuth.renderGitAuthForm(() => dialog.remove(), {
                host: message.hostname
            })
        );

        dialog.append(container);

        document.body.append(dialog);
    }
}
