import http, { IncomingMessage, ServerResponse } from "http";
import * as ws from "ws";
import path from "path";
import fs from "fs";
import mime from "mime";
import vm from "vm";

export class Server {
    static currentPort = 9000;
    js: ContextJS;
    httpServer: http.Server;
    port: number;
    assetdir: string;
    activeWebSocket = new Set<ws.WebSocket>()

    constructor(workdir: string, assetdir: string, entrypoint?: string) {
        this.port = Server.currentPort;
        Server.currentPort++;
        this.assetdir = assetdir;

        if (entrypoint) {
            this.js = new ContextJS(workdir);
            this.js.run(fs.readFileSync(entrypoint).toString())
        }

        this.httpServer = http.createServer(this.requestListener.bind(this));

        const wss = new ws.WebSocketServer({ server: this.httpServer });
        wss.on("connection", this.wsListener.bind(this));
    }

    private readBody(request: IncomingMessage) {
        return new Promise<string>((resolve) => {
            let data = "";
            request.on('data', chunk => data += chunk.toString());
            request.on('end', () => resolve(data));
        });
    }

    static notFound(response: ServerResponse) {
        response.writeHead(404);
        response.end("Not Found");
    }

    async requestListener(request: IncomingMessage, response: ServerResponse) {
        // remove leading slash
        let pathname = request.url?.slice(1);

        // remove trailing slash
        if (pathname?.endsWith("/"))
            pathname = pathname.slice(0, -1);

        const maybeFileName = pathname !== undefined
            ? path.resolve(this.assetdir, pathname || "index.html")
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

        if (!this.js) {
            return Server.notFound(response);
        }

        const body = await this.readBody(request)
        const jsResponse = this.js.processRequest(pathname as string, body);
        if (!jsResponse) {
            return Server.notFound(response);
        }

        const { isJSON, data } = jsResponse;

        if (isJSON)
            response.setHeader("Content-Type", "application/json");

        if (data)
            response.write(data);

        response.end();
    }

    wsListener(conn: ws.WebSocket) {
        this.activeWebSocket.add(conn);

        conn.on("error", console.error);

        conn.on("message", data => {
            // TODO
        });

        conn.on("close", () => this.activeWebSocket.delete(conn));
    }

    start() {
        this.httpServer.listen(this.port)
    }
}

class ContextJS {
    ctx: vm.Context;

    constructor(workdir: string) {
        this.ctx = vm.createContext({
            workdir,
            fs,
            console: {
                log: console.log
            }
        });
    }

    processRequest(pathname: string, body: string) {
        const script = new vm.Script(`api.default("${pathname}", \`${body}\`)`);
        const jsResponse = script.runInContext(this.ctx);
        return jsResponse as ({ isJSON: boolean, data: string } | undefined)
    }

    run(script: string) {
        new vm.Script(script).runInContext(this.ctx)
    }
}