import http, { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import mime from "mime-types"

const dist = "../../dist/webview";

function requestListener(request: IncomingMessage, response: ServerResponse) {
    // remove leading slash
    let pathname = request.url?.slice(1);

    // remove trailing slash
    if(pathname?.endsWith("/"))
        pathname = pathname.slice(0, -1);

    const maybeFileName = pathname !== undefined
        ? path.resolve(dist, pathname || "index.html")
        : null;

    if(maybeFileName && fs.existsSync(maybeFileName)){
        response.writeHead(200, {
            "Content-Type": mime.lookup(maybeFileName),
            "Content-Length": fs.statSync(maybeFileName).size
        } as any)
        const readStream = fs.createReadStream(maybeFileName);
        readStream.pipe(response);
        return;
    }

    response.writeHead(404);
    response.end("Not Found");
} 

http
    .createServer(requestListener)
    .listen(8080);

console.log("http://localhost:8080")