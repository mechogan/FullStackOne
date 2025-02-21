import "./init";
import core_message from "../lib/core_message";
import { deeplink, WindowsAskForAdmin } from "./deeplink";
import { Demo } from "./demo";
import config from "./lib/config";
import { CONFIG_TYPE } from "./types";
import { updatePackagesView } from "./views/packages";
import { Projects } from "./views/projects";
import platform, { Platform } from "../lib/platform";

core_message.addListener("deeplink", deeplink);

// fix windows scrollbars
// if (navigator.userAgent.includes("Windows")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/windows.css";
    document.head.append(link);
// }

document.querySelector("#splash")?.remove();
Projects();

core_message.addListener("package", (dataStr) => {
    try {
        updatePackagesView(JSON.parse(dataStr));
    } catch (e) {
        console.log(dataStr);
    }
});
WindowsAskForAdmin();
const checkProjectsConfigExists = await config.get(CONFIG_TYPE.PROJECTS, true);
if (!checkProjectsConfigExists) {
    if (platform === Platform.WINDOWS) {
        WindowsAskForAdmin();
    }

    Demo();
}
