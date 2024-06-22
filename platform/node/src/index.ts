#!/usr/bin/env node
import http from "http";
import esbuild from "esbuild";
import os from "os";
import url from "url";
import path from "path";
import ws, { WebSocketServer } from "ws";
import openURL from "open";
import { OpenFunction, PushFunction, main } from "./main";
import { SetupDirectories } from "../../../editor/rpc";
import { AddressInfo } from "net";
import { readBody, respond } from "./http-utils";
import { Platform } from "../../../src/platforms";

const startingPort = parseInt(process.env.PORT) || 9000;

type RunningInstance = {
    server: http.Server;
    ws: Set<ws.WebSocket>;
};

const runningInstances = new Map<string, RunningInstance>();

const isWebContainer = !!process.versions?.webcontainer;

const currentDir = path.dirname(url.fileURLToPath(import.meta.url));
const rootDirectory = os.homedir();
const configDirectory = process.env.CONFIG_DIR || ".config/fullstacked";

const directories: SetupDirectories = {
    rootDirectory,
    baseJS: path.resolve(currentDir, "js", "index.js"),
    cacheDirectory: ".cache/fullstacked",
    configDirectory,
    nodeModulesDirectory: configDirectory + "/node_modules"
};

const open: OpenFunction = (id) => {
    let runningInstance = runningInstances.get(id);

    if (!runningInstance) {
        runningInstance = createRunningInstance(id);
        runningInstances.set(id, runningInstance);
    }

    const port = (runningInstance.server.address() as AddressInfo).port;

    if (!process.env.NO_OPEN && runningInstance.ws.size === 0) {
        openURL(`http://localhost:${port}`);
    }
};

const push: PushFunction = (id, messageType, message) => {
    const runningInstance = runningInstances.get(id || "FullStacked");
    runningInstance?.ws.forEach((ws) =>
        ws.send(JSON.stringify({ messageType, message }))
    );
};

const createServerHandler =
    (id: string) =>
    async (req: http.IncomingMessage, res: http.ServerResponse) => {
        const path = req.url;
        const body = await readBody(req);
        const response = await handler(id, path, body);
        respond(response, res);
    };

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
            if (ws.size === 0) cleanup(id);
        });
    });

    server.listen(port);

    return { server, ws };
};

let cleanupTimeout: ReturnType<typeof setTimeout>;
const cleanup = (id: string) => {
    if(id === "FullStacked") {
        return process.exit(0);
    }
    
    if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
    }
    cleanupTimeout = setTimeout(() => {
        for (const [id, { ws }] of runningInstances.entries()) {
            if (ws.size === 0) {
                stopRunningInstance(id);
            }
        }
        cleanupTimeout = null;
    }, 10 * 1000); // 10s
};

const stopRunningInstance = (id: string) => {
    const runningInstance = runningInstances.get(id);
    if (!runningInstance) return;

    runningInstance.server.close(async () => {
        runningInstances.delete(id);
        await close(id);
    });
};

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
);

open("FullStacked");

const launchURL = process.argv.at(-1).match(/^https?:\/\//)
    ? "fullstacked://" + process.argv.at(-1).replace(/:\/\//, "//")
    : null;

if (launchURL) {
    const interval = setInterval(() => {
        const editor = runningInstances.get("FullStacked");
        if (editor?.ws?.size > 0) {
            push("FullStacked", "launchURL", launchURL);
            clearInterval(interval);
        }
    }, 500);
}
