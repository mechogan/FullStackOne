#!/usr/bin/env node
import path from "node:path";
import os from "node:os";
import url from "node:url";
import { load, setCallback, setDirectories } from "./call";
import { createWebView } from "./webview";
import { createInstance } from "./instance";
import { buildLocalProject } from "./build";
import { getLibPath } from "./lib";
import { createRequire } from "node:module";
import { toByteArray } from "../../../lib/base64";
import { deserializeArgs } from "../../../lib/bridge/serialization";
import { setupDevFiles } from "./dev-files";
globalThis.require = createRequire(import.meta.url);

const currentDirectory = path.dirname(url.fileURLToPath(import.meta.url));

let libDirectory = currentDirectory;
const libArgIndex = process.argv.indexOf("--lib");
if (libArgIndex !== -1) {
    libDirectory = process.argv.at(libArgIndex + 1);
}

load(await getLibPath(libDirectory));

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
        return definedPath;
    }
    return path.resolve(process.cwd(), definedPath);
}

export const cbListener = new Set<typeof cb>();
const cb = (projectId: string, messageType: string, message: string) => {
    cbListener.forEach((c) => c(projectId, messageType, message));

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

const root = parseArgsForPath("--root", process.cwd());
setDirectories({
    root,
    config: parseArgsForPath("--config", currentDirectory),
    editor: parseArgsForPath("--editor", currentDirectory),
    tmp: process.argv.includes("--root")
        ? path.resolve(root, ".tmp")
        : path.resolve(currentDirectory, ".tmp")
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
    await buildLocalProject();
    setupDevFiles();
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
