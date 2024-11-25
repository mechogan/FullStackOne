import { Demo } from "./demo";
import { ipcEditor } from "./ipc";
import { CONFIG_TYPE } from "./types";
import { Packages } from "./views/packages";
import { Projects } from "./views/projects";

// fix windows scrollbars
if (navigator.userAgent.includes("Windows")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/scrollbars.css";
    document.head.append(link);
}

document.querySelector("#splash").remove();
Projects();
Packages();

const checkProjectsConfigExists = await ipcEditor.config.get(
    CONFIG_TYPE.PROJECTS,
    true
);
if (!checkProjectsConfigExists) {
    Demo();
}
