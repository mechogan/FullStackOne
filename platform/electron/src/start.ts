import { app, protocol, BrowserWindow, shell } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { buildAPI, buildWebview } from "../../node/src/build";
import { JavaScript } from "../../node/src/javascript";
import editorContext from "../../node/src/editorContext";

const dist = path.resolve(process.cwd(), "..", "..", "dist");

const home = os.homedir();
const mainjs = new JavaScript(
    home,
    path.join(dist, "webview"),
    fs.readFileSync(path.join(dist, "api", "index.js"), { encoding: "utf-8" }),
    "electron"
);
mainjs.privileged = true;

editorContext(home, mainjs);

const originalZip = mainjs.ctx.zip;
mainjs.ctx.zip = (projectdir: string, items: string[], to: string) => {
    shell.openPath(originalZip(projectdir, items, to));
}

let appID = 1;
mainjs.ctx.run = (projectdir: string, assetdir: string, entrypoint: string, hasErrors: boolean) => {
    const apiScript = buildAPI(path.join(home, entrypoint));

    if(typeof apiScript != 'string' && apiScript?.errors) {
        hasErrors = true;
        mainjs.push("buildError", JSON.stringify(apiScript.errors));
    }

    if(hasErrors)
        return;

    const hostname = `app-${appID}`;
    appID++;
    apps[hostname] = new JavaScript(
        path.join(home, projectdir),
        assetdir,
        apiScript as string,
        "electron"
    );

    createWindow(hostname).then(appWindow => {
        apps[hostname].push = message =>
            appWindow.webContents.executeJavaScript(`window.push(\`${message.replace(/\\/g, "\\\\")}\`)`);
    });
}

const apps: { [hostname: string]: JavaScript } = {
    "main": mainjs
}
const handle = async (request: Request) => {
    const headers = {}
    Array.from(request.headers.entries()).map(([name, value]) => {
        headers[name] = value;
    })

    const url = new URL(request.url);
    const hostname = url.hostname;
    const pathname = url.pathname;

    const body = new Uint8Array(await request.arrayBuffer());

    const js = apps[hostname];

    return new Promise<Response>(resolve => {
        js.processRequest(headers, pathname, body, jsResponse => {
            const responseBody = jsResponse.data
                ? (jsResponse.data as Uint8Array).buffer
                : null;

            const response = new Response(responseBody, {
                headers: responseBody
                    ? {
                        ["Content-Type"]: jsResponse.mimeType,
                        ["Content-Length"]: (jsResponse.data?.length || 0).toString()
                    }
                    : undefined
            });

            resolve(response);
        })
    });
}
protocol.handle('http', handle);


const createWindow = async (hostname: string) => {
    const appWindow = new BrowserWindow({
        width: 800,
        height: 600,
    });

    appWindow.loadURL(`http://${hostname}`);

    return appWindow;

    // const outdir = "esbuild"
    // fs.mkdirSync(outdir, { recursive: true });

    // const esbuildResponse = await fetch(`https://registry.npmjs.org/esbuild/${esbuildVersion}`);
    // const esbuildPackage = await esbuildResponse.json();
    // const esbuildtarballUrl = esbuildPackage.dist.tarball;
    // const esbuildTarball = "esbuild.tgz";
    // const esbuildWiteStream = fs.createWriteStream(esbuildTarball);

    // await new Promise(resolve => {
    //   https.get(esbuildtarballUrl, (res) => {
    //     res.pipe(esbuildWiteStream);
    //     esbuildWiteStream.on("close", resolve)
    //   });
    // });

    // const esbuildOutdir = path.join(outdir, "esbuild");
    // fs.mkdirSync(esbuildOutdir, { recursive: true });
    // await tar.extract({
    //   file: esbuildTarball,
    //   strip: 1,
    //   C: esbuildOutdir
    // });


    // const { pkg, subpath } = pkgAndSubpathForCurrentPlatform();
    // const npmResponse = await fetch(`https://registry.npmjs.org/${pkg}/${esbuildVersion}`);
    // const latestEsbuild = await npmResponse.json();
    // const tarballUrl = latestEsbuild.dist.tarball;
    // const tarball = "esbuild.tgz";
    // const writeStream = fs.createWriteStream(tarball);

    // await new Promise(resolve => {
    //   https.get(tarballUrl, (res) => {
    //     res.pipe(writeStream);
    //     writeStream.on("close", resolve)
    //   });
    // });

    // const esbuildBinOutdir = path.join(outdir, pkg);
    // fs.mkdirSync(esbuildBinOutdir, { recursive: true });
    // await tar.extract({
    //   file: tarball,
    //   strip: 1,
    //   C: esbuildBinOutdir
    // });

    // process.env.ESBUILD_BINARY_PATH = path.resolve(esbuildBinOutdir, subpath);
    // global.esbuild = await import(path.resolve(esbuildOutdir, "lib", "main.js"));
}

createWindow("main").then(appWindow => {
    mainjs.push = (messageType: string, message: string) => {
        appWindow.webContents.executeJavaScript(`window.push("${messageType}", \`${message.replace(/\\/g, "\\\\")}\`)`);
    }
});


app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow("main");
    }
});