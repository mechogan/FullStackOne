import core_message from "../lib/core_message";
import { deeplink } from "./deeplink";
import { Demo } from "./demo";
import config from "./lib/config";
import { CONFIG_TYPE } from "./types";
import { updatePackagesView } from "./views/packages";
import { Projects } from "./views/projects";

core_message.addListener("deeplink", deeplink);

// fix windows scrollbars
if (navigator.userAgent.includes("Windows")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/scrollbars.css";
    document.head.append(link);
}

document.querySelector("#splash")?.remove();
Projects();

core_message.addListener("package", (dataStr) =>
    updatePackagesView(JSON.parse(dataStr))
);

const checkProjectsConfigExists = await config.get(CONFIG_TYPE.PROJECTS, true);
if (!checkProjectsConfigExists) {
    Demo();
}
