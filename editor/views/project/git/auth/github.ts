import api from "../../../../api";
import { GitAuths } from "../../../../api/config/types";
import { Dialog } from "../../../../components/dialog";
import { Button } from "../../../../components/primitives/button";
import { Icon } from "../../../../components/primitives/icon";

type GitHubDeviceFlowOpts = {
    didCancel: () => void;
    onSuccess: (credentials: GitAuths[""]) => void;
};

export function GitHubDeviceFlow(opts: GitHubDeviceFlowOpts) {
    const container = document.createElement("div");
    container.classList.add("github-auth");

    container.innerHTML = `<h3>GitHub Authentication</h3>`;

    const stepsContainer = document.createElement("div");

    const codeText = document.createElement("p");
    codeText.innerText = "1. Copy the following code";

    const codeContainer = document.createElement("code");

    api.git.github.deviceFlowStart().then((code) => {
        codeContainer.innerText = code.user_code;

        verifyTextLink.innerText = code.verification_uri;
        verifyTextLink.href = code.verification_uri;
        verifyLink.href = code.verification_uri;

        const copyButton = Button({
            style: "icon-large",
            iconLeft: "Copy"
        });

        copyButton.onclick = () => {
            copyToClipboard(code.user_code);
            copyButton.replaceWith(Icon("Check"));
        };

        codeContainer.append(copyButton);

        waitAndPoll(code.interval, code.device_code);
    });

    stepsContainer.append(codeText, codeContainer);

    const verifyTextLink = document.createElement("a");
    verifyTextLink.href = "#";
    verifyTextLink.target = "_blank";

    const verifyText = document.createElement("p");
    verifyText.innerHTML = `2. Go to `;
    verifyText.append(verifyTextLink);

    const verifyLink = verifyTextLink.cloneNode(true) as HTMLLinkElement;
    const verifyButton = Button({
        text: "Verify",
        iconRight: "External Link"
    });
    verifyLink.append(verifyButton);

    stepsContainer.append(verifyText, verifyLink);

    const waitText = document.createElement("p");
    waitText.innerText = "3. Wait for validation";

    let didCancel = false;
    const waitAndPoll = async (seconds: number, device_code: string) => {
        if (didCancel) return;
        for (let i = 0; i < seconds; i++) {
            waitText.innerText =
                "3. Wait for validation" +
                Array(i + 1)
                    .fill(null)
                    .map(() => ".")
                    .join("");
            await sleep(1005);
        }
        waitText.innerText = "3. Validating";
        const response = await api.git.github.deviceFlowPoll(device_code);
        if (response.wait) {
            waitAndPoll(response.wait, device_code);
        } else if (response.error) {
            waitText.innerText = "3. " + response.error;
        } else {
            opts.onSuccess({
                username: response.username,
                email: response.email,
                password: response.password
            });
            remove();
        }
    };

    stepsContainer.append(waitText);

    const cancelButton = Button({
        text: "Cancel",
        style: "text"
    });
    cancelButton.onclick = () => {
        didCancel = true;
        remove();
    };

    stepsContainer.append(cancelButton);

    container.append(stepsContainer);

    const { remove } = Dialog(container);
}

function copyToClipboard(str: string) {
    const input = document.createElement("textarea");
    input.innerHTML = str;
    document.body.appendChild(input);
    input.select();
    const result = document.execCommand("copy");
    document.body.removeChild(input);
    return result;
}

function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}
