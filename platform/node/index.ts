import http from "http";
import { IncomingMessage, ServerResponse } from "http";
import { JavaScript } from "./javascript";
import os from "os";
import path from "path";

const dist = path.resolve(process.cwd(), "..", "..", "dist");

const js = new JavaScript(
    os.homedir(),
    path.join(dist, "webview"),
    path.join(dist, "api", "index.js")
);
js.privileged = true;

const readBody = (request: IncomingMessage) => new Promise<Uint8Array>(resolve => {
    const contentLengthStr = request.headers["content-length"] || "0";
    const contentLength = parseInt(contentLengthStr);
    if(!contentLength){
        resolve(new Uint8Array());
        return;
    }

    const body = new Uint8Array(contentLength);
    let i = 0;
    request.on("data", (chunk: Buffer) => {
        for(let j = 0; j < chunk.byteLength; j++){
            body[j + i] = chunk[j]
        }
        i += chunk.length
    });
    request.on("end", () => resolve(body));
});

const requestHandler = async (request: IncomingMessage, response: ServerResponse) => {
    const headers = {};
    Object.entries(request.headers).map(([name, value]) => {
        headers[name] = value;
    })

    const pathname = request.url as string;

    const body = await readBody(request);

    const jsResponse = js.processRequest(headers, pathname, body);

    const responseHeaders = jsResponse.data 
        ? {
            ["Content-Type"]: jsResponse.mimeType,
            ["Content-Length"]: (jsResponse.data?.length || 0).toString()
        }
        : undefined

    response.writeHead(200, responseHeaders);
    if(jsResponse.data)
        response.write(jsResponse.data);
    response.end();
}

const port = 8080;
http
    .createServer(requestHandler)
    .listen(port)

console.log(`http://localhost:${port}`);