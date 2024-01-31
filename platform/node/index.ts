import http, { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import mime from "mime";
import vm from "vm";
import os from "os";
import * as ws from "ws";
import type esbuildType from "esbuild";

declare var esbuild: typeof esbuildType;

try {
    import("esbuild").then(esbuild => global.esbuild = esbuild);
} catch { }

export const port = 8080;

const activeConnections = new Set<ws.WebSocket>();

function readBody(request: IncomingMessage) {
    return new Promise((resolve) => {
        let data = "";
        request.on('data', chunk => data += chunk.toString());
        request.on('end', () => resolve(data));
    });
}

const dist = "../../dist/webview";

const homedir = os.homedir();
const jsContext = vm.createContext({
    workdir: homedir,
    fs,
    console: {
        log: console.log
    },
    run: (workdir: string, entrypoint: string) => {
        const bundle = esbuild.buildSync({
            entryPoints: [path.join(homedir, workdir, entrypoint)],
            bundle: true,
            write: false
        });

        const ctx = vm.createContext({
            console: {
                log: (...args: any[]) => {
                    activeConnections.forEach(conn => conn.send(JSON.stringify(args)))
                }
            }
        });

        const script = new vm.Script(bundle.outputFiles?.at(0)?.text ?? "");
        script.runInContext(ctx);
    }
});

const api = new vm.Script(fs.readFileSync("../../dist/api/index.js").toString());
api.runInContext(jsContext);

async function requestListener(request: IncomingMessage, response: ServerResponse) {
    // remove leading slash
    let pathname = request.url?.slice(1);

    // remove trailing slash
    if (pathname?.endsWith("/"))
        pathname = pathname.slice(0, -1);

    const maybeFileName = pathname !== undefined
        ? path.resolve(dist, pathname || "index.html")
        : null;

    if (maybeFileName && fs.existsSync(maybeFileName)) {
        response.writeHead(200, {
            "Content-Type": mime.getType(maybeFileName),
            "Content-Length": fs.statSync(maybeFileName).size
        } as any)
        const readStream = fs.createReadStream(maybeFileName);
        readStream.pipe(response);
        return;
    }

    const script = new vm.Script(`api.default("${pathname}", \`${await readBody(request)}\`)`);
    const jsResponse = script.runInContext(jsContext);

    if (!jsResponse) {
        response.writeHead(404);
        response.end("Not Found");
        return;
    }

    const { isJSON, data } = jsResponse;

    if (isJSON)
        response.setHeader("Content-Type", "application/json");

    if (data)
        response.write(data);
    response.end();
}

const server = http
    .createServer(requestListener)
    .listen(port);

const wss = new ws.WebSocketServer({ server });

wss.on("connection", conn => {
    activeConnections.add(conn);

    conn.on("error", console.error);

    conn.on("message", data => {
        // TODO
    });

    conn.on("close", () => activeConnections.delete(conn));
});

console.log(`http://localhost:${port}`)