import http, { IncomingMessage } from "http";
import ws, { WebSocketServer } from "ws";
import { TextEncoder, TextDecoder } from "util";
import mime from "mime";
import type { Adapter } from "../../../src/adapter";
import { initAdapter } from "./adapter";


type Response = {
    data: Uint8Array,
    status: number,
    mimeType: string
}

const te = new TextEncoder();
const td = new TextDecoder();

const notFound: Response = {
    data: te.encode("Not Found"),
    status: 404,
    mimeType: "text/plain"
};

const readBody = (request: IncomingMessage) => new Promise<Uint8Array>((resolve) => {
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
    static platform = "node";

    static port = 9000;
    port: number;

    server: http.Server = http.createServer(this.requestListener.bind(this));
    wss: ws.WebSocketServer = new WebSocketServer({ server: this.server });
    webSockets: Set<ws.WebSocket> = new Set();

    adapter: Adapter;

    constructor(
        baseDirectory: string
    ) {
        this.adapter = initAdapter(baseDirectory);
        this.port = Instance.port;
        Instance.port++;
    }

    protected async requestListener(req: http.IncomingMessage, res: http.ServerResponse) {
        let response: Response = { ...notFound };

        // remove query params
        let pathname = req.url.split("?").shift();

        // remove trailing slash
        if (pathname?.endsWith("/")) 
            pathname = pathname.slice(0, -1);

        // remove leading slash
        if (pathname?.startsWith("/")) 
            pathname = pathname.slice(1);

        // check for [path]/index.html
        let maybeIndexHTML = pathname + "/index.html";
        if ((await this.adapter.fs.exists(maybeIndexHTML))?.isFile) {
            pathname = maybeIndexHTML;
        }

        // static file serving
        if ((await this.adapter.fs.exists(pathname))?.isFile) {
            const data = await this.adapter.fs.readFile(pathname) as Uint8Array;
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
                const args = body && body.length ? JSON.parse(td.decode(body), (key: string, value: any) => {
                    if(typeof value === "object" && value.hasOwnProperty("type") && value.type === "Uint8Array"){
                        return new Uint8Array(value.data);
                    }
                    return value;
                }) : [];
        
                let responseBody = typeof method === "function" 
                    ? method(...args) 
                    : method;
        
                // await all promises
                while (responseBody instanceof Promise) {
                    responseBody = await responseBody;
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
            "content-length": response.data?.byteLength || "0",
            "content-type": response.mimeType
        });
        res.end(response.data);
    }

    start(){
        this.server.listen(this.port);
    }
}