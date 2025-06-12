#!/usr/bin/env node
import path from "node:path";
import os from "node:os";
import { load, setCallback, setDirectories } from "./call";
import { createWebView } from "./webview";
import { createInstance } from "./instance";
import { buildLocalProject } from "./build";

load("win32-x64.dll");

let deeplink: string = null,
    deeplinkMessaged = false;
if (process.argv.at(-1).startsWith("http")) {
    deeplink = process.argv.at(-1);
}

function parseArgsForPath(arg: string, fallback: string = process.cwd()) {
    const indexOfArg = process.argv.indexOf(arg);
    if (indexOfArg === -1) return fallback;
    const definedPath = process.argv.at(indexOfArg + 1);
    if (definedPath.startsWith("~/")) {
        return path.resolve(os.homedir(), definedPath.slice(2));
    } else if (definedPath.startsWith("/")) {
        return definedPath
    }
    return path.resolve(process.cwd(), definedPath);
}

const cb = (projectId: string, messageType: string, message: string) => {
    if (projectId === "*") {
        for (const w of webViews.values()) {
            w.message(messageType, message);
        }
        return;
    } else if (!projectId && messageType === "open") {
        openProject(message);
        return;
    }

    const webview = webViews.get(projectId);
    webview?.message(messageType, message);
};
setCallback(cb);

setDirectories({
    root: parseArgsForPath("--root"),
    config: parseArgsForPath("--config"),
    editor: parseArgsForPath("--editor", "node_modules/fullstacked/editor")
});

export const platform = new TextEncoder().encode("node");

type WebView = Awaited<ReturnType<typeof createWebView>>;

const webViews = new Map<string, WebView>();

async function openProject(id: string) {
    let webView = webViews.get(id);
    if (webView) {
        return;
    }

    const instance = createInstance(id);
    webView = await createWebView(instance, () => webViews.delete(id));
    webViews.set(id, webView);
}


const mainInstanceId = process.argv.includes("--editor") ? "" : ".";

if (mainInstanceId === ".") {
    await buildLocalProject()
}

const mainInstance = createInstance(mainInstanceId, mainInstanceId === "");
const mainInstanceWebView = await createWebView(mainInstance, null, () => {
    if (!deeplink || deeplinkMessaged) return;
    mainInstanceWebView.message("deeplink", "fullstacked://" + deeplink);
    deeplinkMessaged = true;
});
webViews.set(mainInstanceId, mainInstanceWebView);

["SIGINT", "SIGTERM", "SIGQUIT"].forEach((signal) =>
    process.on(signal, () => process.exit())
);
