import fs from "fs";
import path from "path";
import vm from "vm";
import os from "os";
import type esbuildType from "esbuild";
import { Server } from "./Server";

declare var esbuild: typeof esbuildType;

try {
    import("esbuild").then(esbuild => global.esbuild = esbuild);
} catch { }

const homedir = os.homedir();
export const mainServer = new Server(homedir, "../../dist/webview",  "../../dist/api/index.js");

mainServer.js.ctx.run = (workdir: string, entrypoint: string) => {
    const server = new Server(path.join(homedir, workdir), path.join(homedir, workdir));

    const logToWebView = (...args: any[]) => {
        mainServer.activeWebSocket.forEach(conn => conn.send(JSON.stringify(args)))
    }

    server.start();

    logToWebView(`http://localhost:${server.port}`);

    const bundle = esbuild.buildSync({
        entryPoints: [path.join(homedir, workdir, entrypoint)],
        bundle: true,
        write: false
    });

    const ctx = vm.createContext({
        console: {
            log: (...args: any[]) => {
                mainServer.activeWebSocket.forEach(conn => conn.send(JSON.stringify(args)))
            }
        }
    })

    const script = new vm.Script(bundle.outputFiles?.at(0)?.text ?? "");
    script.runInContext(ctx);
}

mainServer.start();
console.log(`http://localhost:${mainServer.port}`);