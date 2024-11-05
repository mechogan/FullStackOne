
import http from "http";
import open from "open";
import path from "path";
import os from "os";
import { numberTo4Bytes } from "../../../src/serialization";
import { call, setDirectories } from "./call";


await setDirectories({
    root: path.resolve(os.homedir(), "FullStacked"),
    config: path.resolve(os.homedir(), ".config", "fullstacked"),
    nodeModules: path.resolve(os.homedir(), ".config", "fullstacked", "node_modules"),
    editor: path.resolve(process.cwd(), "editor"),
})

const platform = new TextEncoder().encode("node");

const readBody = (req: http.IncomingMessage) =>
    new Promise<Uint8Array>((resolve) => {
        const contentLengthStr = req.headers["content-length"] || "0";
        const contentLength = parseInt(contentLengthStr);
        if (!contentLength) {
            resolve(new Uint8Array());
            return;
        }

        const body = new Uint8Array(contentLength);
        let i = 0;
        req.on("data", (chunk: Buffer) => {
            for (let j = 0; j < chunk.byteLength; j++) {
                body[j + i] = chunk[j];
            }
            i += chunk.length;
        });
        req.on("end", () => resolve(body));
    });

const te = new TextEncoder();

const requestHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    console.log(req.url);

    if (req.url === "/platform") {
        res.writeHead(200, {
            "content-type": "text/plain",
            "content-length": platform.length
        });
        return res.end(platform);
    }
    else if (req.url === "/call") {
        const payload = await readBody(req);
        const data = await call(payload);
        res.writeHead(200, {
            "content-type": "application/octet-stream",
            "content-length": data.length,
            "cache-control": "no-cache"
        });
        return res.end(data)
    }


    // static file serving

    const uint8array = te.encode(req.url);
    const payload = new Uint8Array([
        1, // isEditor

        ...numberTo4Bytes(0), // no project id

        1, // Static File Method

        // args

        2, // arg type: STRING
        ...numberTo4Bytes(uint8array.length), // arg length
        ...uint8array // arg data
    ])

    const [mimeType, body] = await call(payload)

    // not found
    if (!mimeType) {
        const body = te.encode("Not Found");
        res.writeHead(404, {
            "content-type": "text/plain",
            "content-length": body.length,
            "cache-control": "no-cache"
        });
        return res.end(body);
    }

    res.writeHead(200, {
        "content-type": mimeType,
        "content-length": body.length,
        "cache-control": "no-cache"
    });
    res.end(body);
}

const port = 9000;

http
    .createServer(requestHandler)
    .listen(port);

open(`http://localhost:${port}`);

['SIGINT', 'SIGTERM', 'SIGQUIT']
    .forEach(signal =>
        process.on(signal, () => process.exit()));