import core_message from "../lib/core_message";
import { Button } from "./components/primitives/button";
import { SnackBar } from "./components/snackbar";
import { deeplink } from "./deeplink";
import { Demo } from "./demo";
import config from "./lib/config";
import { CONFIG_TYPE } from "./types";
import { Packages } from "./views/packages";
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
Packages();

const checkProjectsConfigExists = await config.get(CONFIG_TYPE.PROJECTS, true);
if (!checkProjectsConfigExists) {
    Demo();
}

let snackbar: ReturnType<typeof SnackBar>;
const dismissButton = Button({
    style: "text",
    text: "Dismiss"
})
dismissButton.onclick = () => snackbar?.dismiss()

setTimeout(() => snackbar = SnackBar({
    message: "Welcome to FullStacked",
    button: dismissButton
}), 2000);

setTimeout(() => SnackBar({
    message: "Welcome to FullStacked",
}), 2100);

setTimeout(() => SnackBar({
    message: "A very very long multi-line SnackBar message for some very very import information",
}), 2200);

setTimeout(() => SnackBar({
    message: "Welcome to FullStacked"
}), 2300);
