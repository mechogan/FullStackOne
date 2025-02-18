import { GitHubDeviceFlow } from "./github";
import { createElement } from "../../../../components/element";
import { CONFIG_TYPE } from "../../../../types";
import config from "../../../../lib/config";
import { Button, Dialog, InputText } from "@fullstacked/ui";

export function GitAuth(hostname: string): Promise<boolean> {
    if (hostname === "github.com") {
        return GitHubDeviceFlow();
    }

    const container = createElement("div");
    container.classList.add("git-auth");

    container.innerHTML = `<h3>Git Authentication</h3>
    <p>Authenticate for <b>${hostname}</b></p>`;

    const form = document.createElement("form");

    const usernameInput = InputText({
        label: "Username"
    });
    const emailInput = InputText({
        label: "Email <span>(optional)</span>"
    });
    emailInput.input.type = "email";
    const passwordInput = InputText({
        label: "Password"
    });
    passwordInput.input.type = "password";

    const buttons = document.createElement("div");

    const cancelButton = Button({
        text: "Cancel",
        style: "text"
    });
    cancelButton.type = "button";

    const authButton = Button({
        text: "Authenticate"
    });
    buttons.append(cancelButton, authButton);
    form.append(
        usernameInput.container,
        emailInput.container,
        passwordInput.container,
        buttons
    );

    container.append(form);

    const { remove } = Dialog(container);

    return new Promise<boolean>((resolve) => {
        cancelButton.onclick = () => {
            resolve(false);
            remove();
        };

        form.onsubmit = async (e) => {
            e.preventDefault();

            authButton.disabled = true;

            const gitAuthConfigs = await config.get(CONFIG_TYPE.GIT);
            gitAuthConfigs[hostname] = {
                username: usernameInput.input.value,
                email: emailInput.input.value,
                password: passwordInput.input.value
            };
            await config.save(CONFIG_TYPE.GIT, gitAuthConfigs);

            resolve(true);
            remove();
        };
    });
}
