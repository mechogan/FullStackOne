import mime from "mime";
import { UTF8ToStr, strToUTF8 } from "./utf8";
import type { fs as fsType } from "./fs";
import type { fetch as fetchType } from "./fetch";

declare var assetdir: string;
declare var platform: string;
declare var fs: typeof fsType;
declare var fetch: typeof fetchType

let methods = {
    fs,
    fetch,
    platform
};

const notFound = {
    data: strToUTF8("Not Found"),
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
    let response: Response = notFound;

    // remove trailing slash
    if (pathname?.endsWith("/")) pathname = pathname.slice(0, -1);

    // remove leading slash
    if (pathname?.startsWith("/")) pathname = pathname.slice(1);

    let maybeFileName = assetdir ? assetdir + "/" + pathname : pathname;

    // check for [path]/index.html
    let maybeIndexHTML = maybeFileName + "/index.html";
    if (await fs.exists(maybeIndexHTML, { absolutePath: true })) {
        maybeFileName = maybeIndexHTML;
    }

    // we'll check for a built file
    if (
        maybeFileName.endsWith(".js") ||
        maybeFileName.endsWith(".css") ||
        maybeFileName.endsWith(".map")
    ) {
        const maybeBuiltFile = ".build/" + maybeFileName;
        if (await fs.exists(maybeBuiltFile, { absolutePath: true })) {
            maybeFileName = maybeBuiltFile;
        }
    }

    if (await fs.exists(maybeFileName, { absolutePath: true })) {
        const data = (await fs.readFile(maybeFileName, {
            absolutePath: true
        })) as Uint8Array;
        response = {
            mimeType: mime.getType(maybeFileName) || "text/plain",
            data
        };
    }

    const methodPath = pathname.split("/");
    const method = methodPath.reduce(
        (api, key) => (api ? api[key] : undefined),
        methods
    ) as any;

    if (method) {
        const args = body && body.length ? JSON.parse(UTF8ToStr(body)) : [];

        let responseBody =
            typeof method === "function" ? method(...args) : method;

        while (typeof responseBody?.then === "function") {
            responseBody = await responseBody;
        }

        let type = "text/plain";
        if (responseBody) {
            if (ArrayBuffer.isView(responseBody)) {
                type = "application/octet-stream";
                responseBody = new Uint8Array(responseBody.buffer);
            } else {
                if (typeof responseBody !== "string") {
                    type = "application/json";
                    responseBody = JSON.stringify(responseBody);
                }
                responseBody = strToUTF8(responseBody);
            }
            response.data = responseBody;
        } else {
            delete response.data;
        }

        response.mimeType = type;
    }

    return response;
};
