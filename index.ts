import http, { IncomingMessage, ServerResponse } from "http";
import fs from "fs";
import path from "path";
import mime from "mime-types";
import * as sass from "sass";
import { OutgoingHttpHeaders } from "http2";
import { buildSync } from "esbuild";

const assetsDir = "src/assets";

const requestListener = async (req: IncomingMessage, res: ServerResponse) => {
    let pathname = req.url?.split("?").shift();

    // remove trailing slash
    if(pathname?.endsWith("/"))
        pathname = pathname.slice(0, -1)

    // remove leadinig slash
    if(pathname?.startsWith("/"))
        pathname = pathname.slice(1);
    
    // CSS
    if (pathname === "style.css") {
        res.writeHead(200, { "content-type": "text/css" });
        res.end(sass.compile("src/style.scss").css);
        return;
    }
    // Assets
    else if (pathname?.startsWith("assets")) {
        const assetPath = path.resolve(assetsDir, pathname.slice("assets/".length));
        if(fs.existsSync(assetPath)){
            res.writeHead(200, {
                "content-type": mime.lookup(assetPath),
                "content-length": fs.statSync(assetPath).size
            } as OutgoingHttpHeaders);
            const readStream = fs.createReadStream(assetPath);
            readStream.pipe(res);
        }
        else {
            res.writeHead(404);
            res.end("Not Found");
        }
        return;
    }
    // scripts
    else if (pathname?.endsWith(".js")) {
        const tsFileName = pathname.slice(0, -2) + "ts";
        const scriptPath = "src/" + tsFileName;
        if(fs.existsSync(scriptPath)){
            let outfile = ".cache/" + scriptPath.slice(0, -2) + "js"
            buildSync({
                entryPoints: [scriptPath],
                outfile,
                bundle: true
            })
            res.writeHead(200, {
                "content-length": fs.statSync(outfile).size,
                "content-type": "text/javascript"
            });
            const readStream = fs.createReadStream(outfile);
            readStream.pipe(res);
        }
        else {
            res.writeHead(404);
            res.end("Not Found");
        }
        return;
    }

    if (pathname === "") {
        res.writeHead(200, { "content-type": "text/html" });
        const readStream = fs.createReadStream("src/index.html");
        readStream.pipe(res);
        return;
    }

    res.writeHead(404);
    res.end("Not Found");
}

const server = http
    .createServer(requestListener)
    .listen(8080);

console.log("http://localhost:8080");
