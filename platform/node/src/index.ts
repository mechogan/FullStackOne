import { JavaScript } from "./javascript";
import os from "os";
import path from "path";
import createInstance from "./createInstance";
import open from "open";
import { buildAPI } from "./build";
import fs from "fs";

const home = os.homedir();
const dist = path.resolve(process.cwd(), "..", "..", "dist");

const js = new JavaScript(
    home,
    path.join(dist, "webview"),
    fs.readFileSync(path.join(dist, "api", "index.js"), { encoding: "utf-8" })
);
js.privileged = true;

const launchInstance = (js: JavaScript) => {
    const port = createInstance(js);
    open(`http://localhost:${port}`);
}

js.ctx.webviewBase = path.resolve(process.cwd(), "..", "..", "src", "js", "webview.js");
js.ctx.apiBase = path.resolve(process.cwd(), "..", "..", "src", "js", "api.js");
js.ctx.resolvePath = (entrypoint: string) => path.join(home, entrypoint);
js.ctx.run = (projectdir: string, assetdir: string, entrypoint: string) => {
    launchInstance(new JavaScript(
        path.join(home, projectdir),
        "",
        buildAPI(path.join(home, entrypoint)) as string
    ));
}

launchInstance(js);