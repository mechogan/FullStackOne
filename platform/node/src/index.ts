#!/usr/bin/env node
import { fileURLToPath } from "url";
import { InstanceEditor } from "./instanceEditor";
import path from "path";
import http from "http";
import { AddressInfo } from "net";

type Response = {
    data: Uint8Array;
    status: number;
    mimeType: string;
};

const launchURL = process.argv.at(-1).match(/^https?:\/\//)
    ? "fullstacked://" + process.argv.at(-1).replace(/:\/\//, "//")
    : null;

const startingPort = process.env.PORT || 9000;
const servers: http.Server[] = [];

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


const createServerForInstance = (instance: Instance) => {
    const requestHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
        const path = req.url;
        const body = await readBody(req);

        const response: Response = instance.handler(path, body);

        const headers = {
            "content-type": response.mimeType
        }

        if(response.data) {
            headers["content-length"] = response.data.length
        }

        res.writeHead(response.status, headers);

        if(response.data) {
            res.write(response.data);
        }

        res.end();
    }

    const server = http.createServer(requestHandler);

    let port = startingPort;
    for(const runningServer of servers) {
        if(port === (runningServer.address() as AddressInfo).port)
            port++;
    }

    server.listen(port);

    servers.push(server);

    if(!process.env.NO_OPEN) {
        open(`http://localhost:${port}`);
    }
}


createServerForInstance(new InstanceEditor(launchURL, path.dirname(fileURLToPath(import.meta.url))));