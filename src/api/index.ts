import mime from "mime";
import { TextEncoder, TextDecoder } from "./utf8";
import type { fs as fsType } from "./fs";
import type { fetch as fetchType } from "./fetch";

declare var assetdir: string;
declare var platform: string;
declare var fs: typeof fsType;
declare var fetch: typeof fetchType;
declare var userMethods: any;

globalThis.TextEncoder = TextEncoder as any;
globalThis.TextDecoder = TextDecoder as any;

const te = new TextEncoder();
const td = new TextDecoder();

let methods = {
    fs,
    fetch,
    platform
};

const notFound = {
    data: te.encode("Not Found"),
    mimeType: "text/plain"
};

export type Response = {
    mimeType: string;
    data?: Uint8Array;
};

export default async (
    headers: Record<string, string>,
    pathname: string,
    body: Uint8Array
): Promise<Response> => {
    let response: Response = { ...notFound };

    // trim whitespaces
    pathname = pathname.trim();

    // remove trailing slash
    if (pathname?.endsWith("/")) pathname = pathname.slice(0, -1);

    // remove leading slash
    if (pathname?.startsWith("/")) pathname = pathname.slice(1);

    // add assets directory in front
    let maybeFileName = assetdir 
        ? assetdir + 
            (pathname ? "/" + pathname : "") 
        : pathname;

    // check for [path]/index.html
    let maybeIndexHTML = maybeFileName + "/index.html";
    if (await fs.isFile(maybeIndexHTML, { absolutePath: true })) {
        maybeFileName = maybeIndexHTML;
    }

    // we'll check for a built file
    if (
        maybeFileName.endsWith(".js") ||
        maybeFileName.endsWith(".css") ||
        maybeFileName.endsWith(".map")
    ) {
        const maybeBuiltFile = ".build/" + maybeFileName;
        if (await fs.isFile(maybeBuiltFile, { absolutePath: true })) {
            maybeFileName = maybeBuiltFile;
        }
    }

    if (await fs.isFile(maybeFileName, { absolutePath: true })) {
        const data = (await fs.readFile(maybeFileName, {
            absolutePath: true
        })) as Uint8Array;
        response = {
            mimeType: mime.getType(maybeFileName) || "text/plain",
            data
        };
    }

    const methodPath = pathname.split("/");
    let method = methodPath.reduce(
        (api, key) => (api ? api[key] : undefined),
        Object.assign(methods, userMethods)
    ) as any;

    if(typeof method === "object" && method.hasOwnProperty("")){
        method = method[""];
    }

    if (method) {
        const args = body && body.length ? JSON.parse(td.decode(body)) : [];

        let responseBody =
            typeof method === "function" ? method(...args) : method;

        // await all promises
        while (typeof responseBody?.then === "function") {
            responseBody = await responseBody;
        }

        let type = "text/plain";
        if(typeof responseBody === "object" && responseBody.hasOwnProperty("type") && responseBody.hasOwnProperty("body")){
            type = responseBody.type;
            responseBody = responseBody.body;
        }
        
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

    return response;
};
