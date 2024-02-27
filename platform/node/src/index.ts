#!/usr/bin/env node

import { JavaScript } from "./javascript";
import os from "os";
import path from "path";
import createInstance from "./createInstance";
import open from "open";
import { buildAPI } from "./build";
import fs from "fs";
import editorContext from "./editorContext";
import esbuild from "esbuild";
import { fileURLToPath } from "url";

global.esbuild = esbuild;

const home = os.homedir();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorDirectory = path.resolve(__dirname, "editor");

const js = new JavaScript(
    console.log,
    home,
    path.join(editorDirectory, "webview"),
    fs.readFileSync(path.join(editorDirectory, "api", "index.js"), {
        encoding: "utf-8"
    }),
    "node"
);
js.privileged = true;

const launchInstance = (js: JavaScript) => {
    const port = createInstance(js);
    if (process.env.NO_OPEN) return;
    open(`http://localhost:${port}`);
};

editorContext(home, js, path.resolve(__dirname, "js"));

js.ctx.checkEsbuildInstall = async () => true;

js.ctx.demoZIP = path.resolve(__dirname, "Demo.zip");

const originalZip = js.ctx.zip;
js.ctx.zip = (projectdir: string, items: string[], to: string) => {
    originalZip(projectdir, items, to);
    js.push("download", to);
};

js.ctx.run = (
    projectdir: string,
    assetdir: string,
    entrypoint: string,
    hasErrors: boolean
) => {
    const apiScript = buildAPI(path.join(home, entrypoint));

    if (typeof apiScript != "string" && apiScript?.errors) {
        hasErrors = true;
        js.push("buildError", JSON.stringify(apiScript.errors));
    }

    if (hasErrors) return;

    const appJS = new JavaScript(
        (...args) => js.push("log", JSON.stringify(args)),
        path.join(home, projectdir),
        assetdir,
        apiScript as string,
        "node"
    );

    launchInstance(appJS);
};

launchInstance(js);

process.on("uncaughtException", (e) => {
    js.push(
        "error",
        JSON.stringify({
            name: e.name,
            stack: e.stack,
            message: e.message
        })
    );
    console.error(e);
});
process.on("unhandledRejection", (e: any) => {
    js.push(
        "error",
        JSON.stringify({
            name: e.name,
            stack: e.stack,
            message: e.message
        })
    );
    console.error(e);
});
