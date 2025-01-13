import { createSubscribable } from ".";
import config from "../lib/config";
import { CONFIG_TYPE } from "../types";

const isUserMode = createSubscribable(getUserMode, false);

export const preferences = {
    setUserMode,
    isUserMode: isUserMode.subscription
};

let userMode: boolean;
let userModePromise: Promise<void>;
async function getUserMode() {
    if (typeof userMode != "boolean") {
        if (!userModePromise) {
            userModePromise = new Promise<void>(async (resolve) => {
                const c = await config.get(CONFIG_TYPE.GENERAL);
                userMode = c?.userMode || false;
                resolve();
            });
        }
        await userModePromise;
    }

    return userMode;
}

async function setUserMode(um: boolean) {
    userMode = um;
    const c = await config.get(CONFIG_TYPE.GENERAL);
    c.userMode = userMode;
    await config.save(CONFIG_TYPE.GENERAL, c);
    isUserMode.notify();
}
