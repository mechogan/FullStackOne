import { JavaScript } from "./javascript";
import os from "os";
import path from "path";
import createInstance from "./createInstance";
import open from "open";

const home = os.homedir();
const dist = path.resolve(process.cwd(), "..", "..", "dist");

const js = new JavaScript(
    home,
    path.join(dist, "webview"),
    path.join(dist, "api", "index.js")
);
js.privileged = true;

const launchInstance = (js: JavaScript) => {
    const port = createInstance(js);
    open(`http://localhost:${port}`);
}

js.ctx.run = (projectdir: string) => {
    launchInstance(new JavaScript(
        path.join(home, projectdir),
        "",
        path.join(dist, "api", "index.js")
    ));
}

launchInstance(js);