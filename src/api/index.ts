import mime from "mime";
import { UTF8ToStr, strToUTF8 } from "./utf8";

export declare var fs: {
    exists(itemPath: string, forAsset?: boolean): boolean;

    readfile(filename: string, forAsset?: boolean): number[] | Uint8Array;
    readfileUTF8(filename: string, forAsset?: boolean): string;

    readdir(directory: string): { name: string; isDirectory: boolean }[];
    mkdir(directory: string): void;

    putfile(filename: string, contents: number[]): void;
    putfileUTF8(filename: string, contents: string): void;

    rm(itemPath: string): void;
};
declare var assetdir: string;
declare var platform: string;

type fetch<T> = (
    url: string,
    options: {
        headers?: Record<string, string>;
        method?: "GET" | "POST" | "PUT" | "DELTE";
        body?: Uint8Array | number[];
    }
) => Promise<{ headers: Record<string, string>; body: T }>;
export declare var fetch: {
    data: fetch<Uint8Array | number[]>;
    UTF8: fetch<string>;
};

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
    data?: number[] | Uint8Array;
};

export default async (
    headers: Record<string, string>,
    pathname: string,
    body: Uint8Array | number[]
): Promise<Response> => {
    let response: Response = notFound;

    // remove trailing slash
    if (pathname?.endsWith("/")) pathname = pathname.slice(0, -1);

    // remove leading slash
    if (pathname?.startsWith("/")) pathname = pathname.slice(1);

    let maybeFileName = assetdir ? assetdir + "/" + pathname : pathname;

    // check for [path]/index.html
    let maybeIndexHTML = maybeFileName + "/index.html";
    if (fs.exists(maybeIndexHTML, true)) {
        maybeFileName = maybeIndexHTML;
    }

    // we'll check for a built file
    if (
        maybeFileName.endsWith(".js") ||
        maybeFileName.endsWith(".css") ||
        maybeFileName.endsWith(".map")
    ) {
        const maybeBuiltFile = ".build/" + maybeFileName;
        if (fs.exists(maybeBuiltFile)) {
            maybeFileName = maybeBuiltFile;
        }
    }

    if (fs.exists(maybeFileName, true)) {
        response = {
            mimeType: mime.getType(maybeFileName) || "text/plain",
            data: fs.readfile(maybeFileName, true)
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

        if (ArrayBuffer.isView(responseBody)) {
            responseBody = Array.from(responseBody as Uint8Array);
        }

        const isJSON = typeof responseBody !== "string";

        response.mimeType = isJSON ? "application/json" : "text/plain";
        if (responseBody) {
            response.data = strToUTF8(
                isJSON ? JSON.stringify(responseBody) : responseBody
            );
        } else {
            delete response.data;
        }
    }

    return response;
};
