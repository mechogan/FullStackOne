import rpc from "../../rpc";

const client_id = "175231928f47d8d36b2d";

export default {
    async deviceFlowStart() {
        const response = await rpc().fetch(
            "https://github.com/login/device/code",
            JSON.stringify({
                client_id,
                scope: "repo,user:email"
            }),
            {
                method: "POST",
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
    },
    async deviceFlowPoll(device_code: string) {
        const response = await rpc().fetch(
            "https://github.com/login/oauth/access_token",
            JSON.stringify({
                client_id,
                device_code,
                grant_type: "urn:ietf:params:oauth:grant-type:device_code"
            }),
            {
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

        const userResponse = await rpc().fetch(
            "https://api.github.com/user",
            null,
            {
                headers: {
                    authorization: `Bearer ${access_token}`,
                    accept: "application/json"
                },
                encoding: "utf8"
            }
        );

        const user = JSON.parse(userResponse.body as string);

        const username = user.login;

        const emailsResponse = await rpc().fetch(
            "https://api.github.com/user/emails",
            null,
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
};
