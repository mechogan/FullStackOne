import { Dialog } from "../../../../components/dialog";
import { Button } from "../../../../components/primitives/button";
import { Icon } from "../../../../components/primitives/icon";
import { createElement } from "../../../../components/element";
import { CONFIG_TYPE } from "../../../../types";
import config from "../../../../lib/config";
import { core_fetch } from "../../../../../lib/core_fetch";

export function GitHubDeviceFlow() {
    const container = createElement("div");
    container.classList.add("github-auth");

    container.innerHTML = `<h3>GitHub Authentication</h3>`;

    const stepsContainer = document.createElement("div");

    const codeText = document.createElement("p");
    codeText.innerText = "1. Copy the following code";

    const codeContainer = document.createElement("code");

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

    stepsContainer.append(waitText);

    const cancelButton = Button({
        text: "Cancel",
        style: "text"
    });
    cancelButton.onclick = () => {
        remove();
    };

    stepsContainer.append(cancelButton);

    container.append(stepsContainer);

    const { remove } = Dialog(container);

    return new Promise<boolean>(async (resolve) => {
        const code = await deviceFlowStart();

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

        let didCancel = false;
        cancelButton.onclick = () => {
            didCancel = true;
            remove();
        };
        const waitAndPoll = async (seconds: number, device_code: string) => {
            if (didCancel) return resolve(false);

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
            const response = await deviceFlowPoll(device_code);
            if (response.wait) {
                waitAndPoll(response.wait, device_code);
            } else if (response.error) {
                waitText.innerText = "3. " + response.error;
                resolve(false);
            } else {
                const gitAuthConfigs = await config.get(
                    CONFIG_TYPE.GIT
                );
                gitAuthConfigs["github.com"] = {
                    username: response.username,
                    email: response.email,
                    password: response.password
                };
                await config.save(CONFIG_TYPE.GIT, gitAuthConfigs);
                resolve(true);
                remove();
            }
        };
        waitAndPoll(code.interval, code.device_code);
    });
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

const client_id = "175231928f47d8d36b2d";

async function deviceFlowStart() {
    const response = await core_fetch(
        "https://github.com/login/device/code",
        {
            method: "POST",
            body: JSON.stringify({
                client_id,
                scope: "repo,user:email"
            }),
            headers: {
                "content-type": "application/json",
                accept: "application/json"
            },
            encoding: "utf8"
        }
    );
    return JSON.parse(response.body as string) as {
        device_code: string;
        user_code: string;
        verification_uri: string;
        interval: number;
    };
}
async function deviceFlowPoll(device_code: string) {
    const response = await core_fetch(
        "https://github.com/login/oauth/access_token",
        {
            body: JSON.stringify({
                client_id,
                device_code,
                grant_type: "urn:ietf:params:oauth:grant-type:device_code"
            }),
            method: "POST",
            headers: {
                "content-type": "application/json",
                accept: "application/json"
            },
            encoding: "utf8"
        }
    );

    const json = JSON.parse(response.body as string);

    if (json.error === "slow_down") return { wait: json.interval };
    else if (json.error === "authorization_pending") return { wait: 5 };

    if (!json.access_token) return { error: "Failed" };

    const { access_token } = json;

    const userResponse = await core_fetch("https://api.github.com/user", {
        headers: {
            authorization: `Bearer ${access_token}`,
            accept: "application/json"
        },
        encoding: "utf8"
    });

    const user = JSON.parse(userResponse.body as string);

    const username = user.login;

    const emailsResponse = await core_fetch(
        "https://api.github.com/user/emails",
        {
            headers: {
                authorization: `Bearer ${access_token}`,
                accept: "application/json"
            },
            encoding: "utf8"
        }
    );

    const emails = JSON.parse(emailsResponse.body as string);

    const email = emails?.find((emailEntry) => emailEntry?.primary)?.email;

    return {
        username,
        email,
        password: access_token
    };
}
