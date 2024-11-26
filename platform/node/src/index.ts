import path from "path";
import os from "os";
import fs from "fs";
import { setCallback, setDirectories } from "./call";
import { createWebView } from "./webview";
import { createInstance } from "./instance";

// MIGRATION 2024-11-05 - 0.9.0 to 0.10.0

const newConfigDir = path.resolve(os.homedir(), ".config", "fullstacked");
const oldConfigDir = path.resolve(os.homedir(), "FullStacked", ".config");
const oldConfigDirExists = fs.existsSync(oldConfigDir);
if (oldConfigDirExists) {
    fs.cpSync(oldConfigDir, newConfigDir, {
        recursive: true,
        filter: (source) => !source.includes("node_modules")
    });
}

// end migration

let deeplink: string = null,
    deeplinkMessaged = false;
if (process.argv.at(-1).startsWith("http")) {
    deeplink = process.argv.at(-1);
}

const root = path.resolve(os.homedir(), "FullStacked");
await setDirectories({
    root,
    config: path.resolve(os.homedir(), ".config", "fullstacked"),
    editor: path.resolve(process.cwd(), "editor")
});

export const platform = new TextEncoder().encode("node");

type WebView = Awaited<ReturnType<typeof createWebView>>;

const webViews = new Map<string, WebView>();

const cb = (projectId: string, messageType: string, message: string) => {
    if (!projectId && messageType === "open") {
        openProject(message);
        return;
    }

    const webview = webViews.get(projectId);
    webview?.message(messageType, message);
};
await setCallback(cb);

async function openProject(id: string) {
    let webView = webViews.get(id);
    if (webView) {
        return;
    }

    const instance = createInstance(id);
    webView = await createWebView(instance, () => webViews.delete(id));
    webViews.set(id, webView);
}

const instanceEditor = createInstance("", true);
const instanceWebView = await createWebView(instanceEditor, null, () => {
    if (!deeplink || deeplinkMessaged) return;
    instanceWebView.message("deeplink", "fullstacked://" + deeplink);
    deeplinkMessaged = true;
});
webViews.set("", instanceWebView);

["SIGINT", "SIGTERM", "SIGQUIT"].forEach((signal) =>
    process.on(signal, () => process.exit())
);
