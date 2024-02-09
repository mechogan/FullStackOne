import http, { IncomingMessage, ServerResponse } from "http";
import { JavaScript } from "./javascript";

let port = 9000;

export default (js: JavaScript) => {
    const listenningPort = port;
    port += 1;

    http
        .createServer((req, res) => requestHandler(req, res, js))
        .listen(listenningPort)
        
    return listenningPort;
}


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

const requestHandler = async (request: IncomingMessage, response: ServerResponse, js: JavaScript) => {
    const headers = {};
    Object.entries(request.headers).map(([name, value]) => {
        headers[name] = value;
    })

    const pathname = request.url as string;

    const body = await readBody(request);

    js.processRequest(headers, pathname, body, jsResponse => {
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
    });
}