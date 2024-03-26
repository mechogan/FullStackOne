import http from "http";
import ws, { WebSocketServer } from "ws";
import { TextEncoder, TextDecoder } from "util";
import mime from "mime";
import type { Adapter } from "../../../src/adapter";
import { initAdapter } from "./adapter";
import { decodeUint8Array } from "../../../src/Uint8Array";
import open from "open";
import type { Project } from "../../../editor/api/projects/types";
import { InstanceEditor } from "./instanceEditor";

type Response = {
    data: Uint8Array;
    status: number;
    mimeType: string;
};

const te = new TextEncoder();
const td = new TextDecoder();

const notFound: Response = {
    data: te.encode("Not Found"),
    status: 404,
    mimeType: "text/plain"
};

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

export class Instance {
    static port = 9000;
    port: number;

    server: http.Server = http.createServer(this.requestListener.bind(this));
    wss: ws.WebSocketServer = new WebSocketServer({ server: this.server });
    webSockets: Set<ws.WebSocket> = new Set();

    adapter: Adapter;

    constructor(project: Project) {
        this.adapter = initAdapter(
            InstanceEditor.rootDirectory + "/" + project.location
        );
        this.port = Instance.port;
        Instance.port++;

        this.wss.on("connection", this.wsOnConnection.bind(this));
    }

    wsOnConnection(ws: ws.WebSocket) {
        this.webSockets.add(ws);
        ws.on("close", () => this.webSockets.delete(ws));
    }

    push(messageType: string, message: any) {
        this.webSockets.forEach((ws) =>
            ws.send(JSON.stringify({ messageType, message }))
        );
    }

    protected async requestListener(
        req: http.IncomingMessage,
        res: http.ServerResponse
    ) {
        let response: Response = { ...notFound };

        // remove query params
        let pathname = req.url.split("?").shift();

        // remove trailing slash
        if (pathname?.endsWith("/")) pathname = pathname.slice(0, -1);

        // remove leading slash
        if (pathname?.startsWith("/")) pathname = pathname.slice(1);

        // check for [path]/index.html
        let maybeIndexHTML = pathname + "/index.html";
        if ((await this.adapter.fs.exists(maybeIndexHTML))?.isFile) {
            pathname = maybeIndexHTML;
        }

        // we'll check for a built file
        if (
            pathname.endsWith(".js") ||
            pathname.endsWith(".css") ||
            pathname.endsWith(".map")
        ) {
            const maybeBuiltFile = ".build/" + pathname;
            if ((await this.adapter.fs.exists(maybeBuiltFile))?.isFile) {
                pathname = maybeBuiltFile;
            }
        }

        // static file serving
        if ((await this.adapter.fs.exists(pathname))?.isFile) {
            const data = (await this.adapter.fs.readFile(
                pathname
            )) as Uint8Array;
            response = {
                status: 200,
                mimeType: mime.getType(pathname) || "text/plain",
                data
            };
        }
        // rpc methods
        else {
            const methodPath = pathname.split("/");
            let method = methodPath.reduce(
                (api, key) => (api ? api[key] : undefined),
                this.adapter
            ) as any;

            if (method) {
                response.status = 200;

                const body = await readBody(req);
                const args =
                    body && body.length
                        ? JSON.parse(td.decode(body), decodeUint8Array)
                        : [];

                let responseBody = method;

                if (typeof responseBody === "function") {
                    try {
                        responseBody = responseBody(...args);
                    } catch (e) {
                        response.status = 299;
                        responseBody = e;
                    }
                }

                // await all promises and functions
                while (responseBody instanceof Promise) {
                    try {
                        responseBody = await responseBody;
                    } catch (e) {
                        response.status = 299;
                        responseBody = e;
                    }
                }

                let type = "text/plain";
                if (responseBody) {
                    if (ArrayBuffer.isView(responseBody)) {
                        type = "application/octet-stream";
                        responseBody = new Uint8Array(responseBody.buffer);
                    } else {
                        if (typeof responseBody !== "string") {
                            type = "application/json";
                            responseBody = JSON.stringify(responseBody);
                        }
                        responseBody = te.encode(responseBody);
                    }
                    response.data = responseBody;
                } else {
                    delete response.data;
                }

                response.mimeType = type;
            }
        }

        res.writeHead(response.status, {
            "content-length": response.data?.byteLength?.toString() || "0",
            "content-type": response.mimeType
        });
        res.end(response.data);
    }

    start() {
        this.server.listen(this.port);
        if (!process.env.NO_OPEN) open(`http://localhost:${this.port}`);
    }
}
