import { text } from "stream/consumers";
import { GitAuths } from "../../../../api/config/types";
import { Dialog } from "../../../../components/dialog";
import { InputText } from "../../../../components/primitives/inputs";
import { GitHubDeviceFlow } from "./github";
import { Button } from "../../../../components/primitives/button";

type GitAuthOpts = {
    hostname: string;
    didSubmit: (credentials: GitAuths[""]) => void;
    didCancel: () => void;
};

export function GitAuth(opts: GitAuthOpts) {
    if (opts.hostname === "github.com") {
        return GitHubDeviceFlow({
            didCancel: opts.didCancel,
            onSuccess: opts.didSubmit
        });
    }

    const container = document.createElement("div");
    container.classList.add("git-auth");

    container.innerHTML = `<h3>Git Authentication</h3>
    <p>Authenticate for <b>${opts.hostname}</b></p>`;

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
    cancelButton.onclick = () => {
        opts.didCancel();
        remove();
    };

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

    form.onsubmit = (e) => {
        e.preventDefault();
        opts.didSubmit({
            username: usernameInput.input.value,
            email: emailInput.input.value,
            password: passwordInput.input.value
        });
        remove();
    };

    container.append(form);

    const { remove } = Dialog(container);
}
