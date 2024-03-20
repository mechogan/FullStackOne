import { auth } from ".";
import type { fetch as globalFetch } from "../../../src/adapter/fetch";

declare var fetch: typeof globalFetch;

const client_id = "175231928f47d8d36b2d";

export default {
    async deviceFlowStart() {
        const response = await fetch("https://github.com/login/device/code", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                accept: "application/json"
            },
            body: JSON.stringify({
                client_id,
                scope: "repo,user:email"
            }),
            encoding: "utf8"
        });
        return response.body as string;
    },
    async deviceFlowPoll(device_code: string) {
        const response = await fetch(
            "https://github.com/login/oauth/access_token",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    accept: "application/json"
                },
                body: JSON.stringify({
                    client_id,
                    device_code,
                    grant_type: "urn:ietf:params:oauth:grant-type:device_code"
                }),
                encoding: "utf8"
            }
        );

        const json = JSON.parse(response.body as string);

        if (json.error === "slow_down") return { wait: json.interval };
        else if (json.error === "authorization_pending") return { wait: 5 };

        if (!json.access_token) return { error: "Failed" };

        const { access_token } = json;

        const userResponse = await fetch("https://api.github.com/user", {
            headers: {
                authorization: `Bearer ${access_token}`,
                accept: "application/json"
            },
            encoding: "utf8"
        });

        const user = JSON.parse(userResponse.body as string);

        const username = user.login;

        const emailsResponse = await fetch(
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

        await auth("github.com", username, email, access_token);
    }
};
