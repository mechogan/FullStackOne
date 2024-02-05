import { app, protocol, BrowserWindow } from "electron";
import path from "path";
import fs from "fs";
import os from "os";
import { buildAPI, buildWebview } from "../../node/src/build";
import { JavaScript } from "../../node/src/javascript";

const dist = path.resolve(process.cwd(), "..", "..", "dist");

const home = os.homedir();
const mainjs = new JavaScript(
    home,
    path.join(dist, "webview"),
    fs.readFileSync(path.join(dist, "api", "index.js"), { encoding: "utf-8" })
);
mainjs.privileged = true;

let appID = 1;
mainjs.ctx.jsDirectory = path.resolve(process.cwd(), "..", "..", "src", "js");
mainjs.ctx.resolvePath = (entrypoint: string) => path.join(home, entrypoint).split("\\").join("/");
mainjs.ctx.run = (projectdir: string, assetdir: string, entrypoint: string) => {
    const hostname = `app-${appID}`;
    appID++;
    apps[hostname] = new JavaScript(
        path.join(home, projectdir),
        assetdir,
        buildAPI(path.join(home, entrypoint)) as string
    );
    createWindow(hostname);
}
mainjs.ctx.buildWebview = buildWebview;

const apps: { [hostname: string] : JavaScript } = {
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

    const jsResponse = js.processRequest(headers, pathname, body);

    const responseBody = jsResponse.data
        ? (jsResponse.data as Uint8Array).buffer
        : null;

    return new Response(responseBody, {
        headers: responseBody 
            ? {
                ["Content-Type"]: jsResponse.mimeType,
                ["Content-Length"]: (jsResponse.data?.length || 0).toString()
            }
            : undefined
    });
}
protocol.handle('http', handle);


const createWindow = async (hostname: string) => {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
    });

    mainWindow.loadURL(`http://${hostname}`);

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

createWindow("main");

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0){
        createWindow("main");
    }
});