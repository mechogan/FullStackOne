import http from "http";
import open from "open";
import path from "path";
import os from "os";
import fs from "fs";
import { deserializeArgs, numberTo4Bytes, serializeArgs } from "../../../src/serialization";
import { call, setDirectories } from "./call";
import fastQueryString from "fast-querystring";
import { fromBase64 } from "../../../editor/api/connectivity/cryptoUtils";

// MIGRATION 2024-11-05 - 0.9.0 to 0.10.0

const newConfigDir = path.resolve(os.homedir(), ".config", "fullstacked");
const oldConfigDir = path.resolve(os.homedir(), "FullStacked", ".config");
const oldConfigDirExists = fs.existsSync(oldConfigDir);
if (oldConfigDirExists) {
    fs.cpSync(oldConfigDir, newConfigDir, {
        recursive: true,
        filter: (source) => !source.includes("node_modules")
    });
}

// end migration

const root = path.resolve(os.homedir(), "FullStacked");
await setDirectories({
    root,
    config: path.resolve(os.homedir(), ".config", "fullstacked"),
    editor: path.resolve(process.cwd(), "editor")
});

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

const requestHandler = async (
    req: http.IncomingMessage,
    res: http.ServerResponse
) => {
    let [pathname, query] = req.url.split("?");
    pathname = decodeURI(pathname);

    if (pathname === "/platform") {
        res.writeHead(200, {
            "content-type": "text/plain",
            "content-length": platform.length
        });
        return res.end(platform);
    } else if (pathname === "/call") {
        const payload = await readBody(req);
        const data = await call(
            new Uint8Array([
                1, // isEditor
                ...numberTo4Bytes(0), // no project id
                ...payload
            ])
        );
        res.writeHead(200, {
            "content-type": "application/octet-stream",
            "content-length": data.length,
            "cache-control": "no-cache"
        });
        return res.end(data);
    } else if (pathname === "/call-sync") {
        const parsedQuery = fastQueryString.parse(query);
        const payloadBase64 = decodeURIComponent(parsedQuery.payload)
        const payload = fromBase64(payloadBase64);
        const data = await call(
            new Uint8Array([
                1, // isEditor
                ...numberTo4Bytes(0), // no project id
                ...payload
            ])
        );
        res.writeHead(200, {
            "content-type": "application/octet-stream",
            "content-length": data.length,
            "cache-control": "no-cache"
        });
        return res.end(data);
    }

    // static file serving

    const uint8array = te.encode(pathname);
    const payload = new Uint8Array([
        1, // isEditor

        ...numberTo4Bytes(0), // no project id

        1, // Static File Method

        // args

        2, // arg type: STRING
        ...numberTo4Bytes(uint8array.length), // arg length
        ...uint8array // arg data
    ]);

    const [mimeType, body] = deserializeArgs(await call(payload));

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
};

const port = 9000;

http.createServer(requestHandler).listen(port);

open(`http://localhost:${port}`);

["SIGINT", "SIGTERM", "SIGQUIT"].forEach((signal) =>
    process.on(signal, () => process.exit())
);
