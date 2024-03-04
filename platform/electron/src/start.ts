import { app, protocol, BrowserWindow, shell } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { buildAPI } from "../../node/src/build";
import { JavaScript } from "../../node/src/javascript";
import editorContext from "../../node/src/editorContext";
import { getVersion, installEsbuild, loadEsbuild } from "./esbuild";
// @ts-ignore
import esbuildVersion from "../../../lib/esbuild/version.txt";

const editorDiretory = path.resolve(__dirname, "..", "editor");

const home = os.homedir();
const mainjs = new JavaScript(
    console.log,
    home,
    path.join(editorDiretory, "webview"),
    fs.readFileSync(path.resolve(editorDiretory, "api", "index.js"), {
        encoding: "utf-8"
    }),
    "electron"
);
mainjs.privileged = true;

editorContext(home, mainjs, path.resolve(__dirname, "..", "js"));

mainjs.ctx.demoZIP = path.resolve(process.resourcesPath, "Demo.zip");

mainjs.ctx.checkEsbuildInstall = async () => {
    const version = getVersion();
    if (version && version !== esbuildVersion) return false;

    if (global.esbuild) return true;

    try {
        await loadEsbuild();
        return true;
    } catch (e) {
        return false;
    }
};
mainjs.ctx.installEsbuild = async () => {
    installEsbuild(mainjs);
};

const originalZip = mainjs.ctx.zip;
mainjs.ctx.zip = (projectdir: string, items: string[], to: string) => {
    let outdir = originalZip(projectdir, items, to);
    if (os.platform() === "win32") outdir = outdir.split("/").join("\\");
    shell.openPath(outdir);
};

let appID = 1;
mainjs.ctx.run = (
    projectdir: string,
    assetdir: string,
    entrypoint: string,
    resolvedNodeModulesDir: string,
    hasErrors: boolean
) => {
    const apiScript = buildAPI(
        path.join(home, entrypoint),
        resolvedNodeModulesDir
    );

    if (typeof apiScript != "string" && apiScript?.errors) {
        hasErrors = true;
        mainjs.push("buildError", JSON.stringify(apiScript.errors));
    }

    if (hasErrors) return;

    const hostname = `app-${appID}`;
    appID++;
    apps[hostname] = new JavaScript(
        (...args) => mainjs.push("log", JSON.stringify(args)),
        path.join(home, projectdir),
        assetdir,
        apiScript as string,
        "electron"
    );

    createWindow(hostname, projectdir).then((appWindow) => {
        apps[hostname].push = (message) =>
            appWindow.webContents.executeJavaScript(
                `window.push(\`${message.replace(/\\/g, "\\\\")}\`)`
            );
    });
};

const apps: { [hostname: string]: JavaScript } = {
    main: mainjs
};
const handle = async (request: Request) => {
    const headers = {};
    Array.from(request.headers.entries()).map(([name, value]) => {
        headers[name] = value;
    });

    const url = new URL(request.url);
    const hostname = url.hostname;
    const pathname = url.pathname;

    const body = new Uint8Array(await request.arrayBuffer());

    const js = apps[hostname];

    return new Promise<Response>((resolve) => {
        js.processRequest(headers, pathname, body, (jsResponse) => {
            const responseBody = jsResponse.data
                ? (jsResponse.data as Uint8Array).buffer
                : null;

            const response = new Response(responseBody, {
                headers: responseBody
                    ? {
                          ["Content-Type"]: jsResponse.mimeType,
                          ["Content-Length"]: (
                              jsResponse.data?.length || 0
                          ).toString()
                      }
                    : undefined
            });

            resolve(response);
        });
    });
};
protocol.handle("http", handle);

const createWindow = async (hostname: string, title: string) => {
    const appWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title,
        icon: "icons/icon.png"
    });

    appWindow.loadURL(`http://${hostname}`);

    return appWindow;
};

createWindow("main", "FullStacked").then((appWindow) => {
    mainjs.push = (messageType: string, message: string) => {
        appWindow.webContents.executeJavaScript(
            `window.push("${messageType}", \`${message.replace(/\\/g, "\\\\")}\`)`
        );
    };
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow("main", "FullStacked");
    }
});
