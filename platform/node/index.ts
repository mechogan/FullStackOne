import http, { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import mime from "mime";
import vm from "vm";

export const port = 8080;

function readBody(request: IncomingMessage) {
    return new Promise((resolve) => {
        let data = "";
        request.on('data', chunk => data += chunk.toString());
        request.on('end', () => resolve(data));
    });
}

const dist = "../../dist/webview";

const jsContext = vm.createContext({
    fs: fs
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

    if(!jsResponse) {
        response.writeHead(404);
        response.end("Not Found");
        return;
    }

    const { isJSON, data } = jsResponse;

    if(isJSON)
        response.setHeader("Content-Type", "application/json");

    response.write(data);
    response.end();
}

http
    .createServer(requestListener)
    .listen(port);

console.log(`http://localhost:${port}`)