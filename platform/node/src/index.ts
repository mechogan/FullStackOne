#!/usr/bin/env node
import http from "http";
import esbuild from "esbuild";
import os from "os";
import url from "url";
import path from "path";
import ws, { WebSocketServer } from "ws";
import openURL from "open"
import { OpenFunction, Platform, PushFunction, main } from "./main";
import { SetupDirectories } from "../../../editor/rpc";
import { AddressInfo } from "net";

const startingPort = process.env.PORT || 9000;

type RunningInstance = {
    server: http.Server,
    ws: Set<ws.WebSocket>
}

const runningInstances = new Map<string, RunningInstance>();

const isWebContainer = !!process.versions?.webcontainer;

const currentDir = path.dirname(url.fileURLToPath(import.meta.url))
const rootDirectory = os.homedir();
const configDirectory = process.env.CONFIG_DIR || ".config/fullstacked";

const directories: SetupDirectories = {
    rootDirectory,
    baseJS: path.resolve(currentDir, "js", "index.js"),
    cacheDirectory: ".cache/fullstacked",
    configDirectory,
    nodeModulesDirectory: configDirectory + "/node_modules"
}

const open: OpenFunction = (id) => {
    let runningInstance = runningInstances.get(id);

    if (!runningInstance) {
        runningInstance = createRunningInstance(id);
        runningInstances.set(id, runningInstance);
    }
    
    const port = (runningInstance.server.address() as AddressInfo).port;
    openURL(`http://localhost:${port}`);
}

const push: PushFunction = (id, messageType, message) => {
    const runningInstance = runningInstances.get(id);
    if (!runningInstance) return;
    runningInstance.ws.forEach(ws => ws.send(JSON.stringify({ messageType, message })));
}

const readBody = (request: http.IncomingMessage) =>
    new Promise<Uint8Array>((resolve) => {
        const contentLengthStr = request.headers["content-length"] || "0";
        const contentLength = parseInt(contentLengthStr);
        if (!contentLength) {
            resolve(new Uint8Array());
            return;
        }

        const body = new Uint8Array(contentLength);
        let i = 0;
        request.on("data", (chunk: Buffer) => {
            for (let j = 0; j < chunk.byteLength; j++) {
                body[j + i] = chunk[j];
            }
            i += chunk.length;
        });
        request.on("end", () => resolve(body));
    });

const createServerHandler = (id: string) =>
    async (req: http.IncomingMessage, res: http.ServerResponse) => {
        const path = req.url;
        const body = await readBody(req);
        const response = await handler(id, path, body);
        const headers = {
            "content-type": response.mimeType
        }
        if (response.data) {
            headers["content-length"] = response.data.byteLength.toString();
        }
        res.writeHead(response.status, headers);
        if (response.data) {
            res.write(response.data);
        }
        res.end();
    }

const createRunningInstance: (id: string) => RunningInstance = (id) => {
    let port = startingPort;
    for (const runningInstance of runningInstances.values()) {
        if (port === (runningInstance.server.address() as AddressInfo).port)
            port++;
    }

    const server = http.createServer(createServerHandler(id));
    const wss = new WebSocketServer({ server });
    const ws = new Set<ws.WebSocket>();

    wss.on("connection", (webSocket) => {
        ws.add(webSocket);
        webSocket.on("close", () => {
            ws.delete(webSocket);
            if(ws.size === 0) {
                stopRunningInstance(id);
            }
        })
    })

    server.listen(port);
    
    return { server, ws }
}

const stopRunningInstance = (id: string) => {
    const runningInstance = runningInstances.get(id);
    if(!runningInstance) return;
    
    runningInstance.server.close(async () => {
        runningInstances.delete(id);
        await close(id);
    });
}

const { handler, close } = main(
    isWebContainer ? Platform.WEBCONTAINER : Platform.NODE,
    currentDir + "/editor", 
    directories,
    {
        load: async () => esbuild,
        install: () => null
    },
    open,
    push,
    null
)

open("FullStacked");

const launchURL = process.argv.at(-1).match(/^https?:\/\//)
    ? "fullstacked://" + process.argv.at(-1).replace(/:\/\//, "//")
    : null;

if (launchURL) {
    const interval = setInterval(() => {
        const editor = runningInstances.get("FullStacked");
        if(editor?.ws?.size > 0) {
            push("FullStacked", "launchURL", launchURL);
            clearInterval(interval);
        }
    }, 500);
}