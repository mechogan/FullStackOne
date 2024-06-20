import type { SetupDirectories } from "../../../editor/rpc";
import type { Project } from "../../../editor/api/projects/types";
import http from "http";
import path from "path";
import os from "os";
import esbuild from "esbuild";
import url from "url";
import slugify from "slugify";
import { WebSocketServer, WebSocket } from "ws";
import {
    OpenDirectoryFunction,
    OpenFunction,
    PushFunction,
    main
} from "../../node/src/main";
import { readBody, respond } from "../../node/src/http-utils";
import { Platform } from "../../../src/platforms";
import "./remote/server"

type RunningInstance = {
    subdomain: string;
    wss: WebSocketServer;
    ws: Set<WebSocket>;
};

// subdomain => id
const subdomains = new Map<string, string>();
// id => RunningInstance
const runningInstances = new Map<string, RunningInstance>();

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

const createRunningInstance: (
    id: string,
    project?: Project
) => RunningInstance = (id, project) => {
    const subdomain = slugify(project?.title ?? "", { lower: true });

    subdomains.set(subdomain, id);

    const ws = new Set<WebSocket>();
    const wss = new WebSocketServer({ noServer: true });
    wss.on("connection", (webSocket) => {
        ws.add(webSocket);
        webSocket.on("close", () => {
            ws.delete(webSocket);

            if (ws.size === 0) {
                cleanup();
            }
        });
    });

    return { subdomain, ws, wss };
};

let cleanupTimeout: ReturnType<typeof setTimeout>;
const cleanup = () => {
    if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
    }
    cleanupTimeout = setTimeout(() => {
        for (const [id, { subdomain, ws, wss }] of runningInstances.entries()) {
            if (id === "FullStacked") continue;

            if (ws.size === 0) {
                wss.close(() => {
                    subdomains.delete(subdomain);
                    runningInstances.delete(id);
                    close(id);
                });
            }
        }
        cleanupTimeout = null;
    }, 10 * 1000); // 10s
};

const open: OpenFunction = (id, project) => {
    let runningInstance = runningInstances.get(id);

    if (!runningInstance) {
        runningInstance = createRunningInstance(id, project);
        runningInstances.set(id, runningInstance);
    } else {
        push(id, "reload", "");
    }

    push("FullStacked", "open", runningInstance.subdomain);
};

const push: PushFunction = (id, messageType, message) => {
    const runningInstance = runningInstances.get(id || "FullStacked");
    runningInstance?.ws.forEach((ws) =>
        ws.send(JSON.stringify({ messageType, message }))
    );
};
const openDirectory: OpenDirectoryFunction = () => null;

const { handler, close } = main(
    Platform.DOCKER,
    currentDir + "/editor",
    directories,
    {
        load: async () => esbuild,
        install: () => null
    },
    open,
    push,
    openDirectory
);

const port = process.env.PORT || 9000;

const requestHandler = async (
    req: http.IncomingMessage,
    res: http.ServerResponse
) => {
    if (req.headers["upgrade"] === "websocket") {
        return;
    }

    const host = (
        req.headers["x-forwarded-for"] || req.headers.host
    ).toString();
    const subdomain = host.split(".").shift();
    const id = subdomains.get(subdomain);

    const path = req.url;
    const body = await readBody(req);
    const response = await handler(id, path, body);
    respond(response, res);
};

const server = http.createServer(requestHandler);

open("FullStacked");

server.on("upgrade", (req, socket, head) => {
    const host = (
        req.headers["x-forwarded-for"] || req.headers.host
    ).toString();
    const subdomain = host.split(".").shift();
    const id = subdomains.get(subdomain);

    const runningInstance =
        runningInstances.get(id) ?? runningInstances.get("FullStacked");

    runningInstance.wss.handleUpgrade(req, socket, head, (ws) => {
        runningInstance.wss.emit("connection", ws, req);
    });
});

server.listen(port);