import projects from "./projects";
import mime from "mime";

declare var requests: {
    [requestId: string]: {
        headers: {
            [headerName: string]: string
        },
        pathname: string,
        body: number[]
    }
}

export declare var fs: {
    exists(itemPath: string, forAsset?: boolean): boolean

    readfile(filename: string, forAsset?: boolean): number[] | Uint8Array
    readfileUTF8(filename: string): string

    readdir(directory: string): { name: string, isDirectory: boolean }[]
    mkdir(directory: string): void

    putfile(filename: string, contents: number[]): void
    putfileUTF8(filename: string, contents: string): void

    rm(itemPath: string): void
}
declare var assetdir: string

export const api = {
    helloWorld(greeting: string) {
        return {
            message: greeting + " World",
            from: "JS"
        }
    },
    fs,
    projects
}

const strToUint8 = (str: string) => {
    if(!str) return [];

    const uint8arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        uint8arr[i] = str.charCodeAt(i)
    }
    return uint8arr;
}

const UInt8ToStr = (arr: Uint8Array | number[]) => {
    let str = "";
    for (let i = 0; i < arr.length; i++) {
        str += String.fromCharCode(arr[i])
    }
    return str;
}

const notFound = {
    data: strToUint8("Not Found"),
    mimeType: "text/plain"
}

export type Response = {
    mimeType: string,
    data?: number[] | Uint8Array
}

export default (requestId: string): Response => {
    let { headers, pathname, body } = requests[requestId];
    let response: Response = notFound;
    
    if (pathname?.endsWith("/"))
        pathname = pathname.slice(0, -1);

    if(pathname?.startsWith("/"))
        pathname = pathname.slice(1);

    if(pathname === "")
        pathname = "index.html";

    const maybeFileName = assetdir 
        ? assetdir + "/" + pathname
        : pathname;

    if (fs.exists(maybeFileName, true)) {
        response = {
            mimeType: mime.getType(maybeFileName) || "text/plain",
            data: fs.readfile(maybeFileName, true)
        };
    }

    const methodPath = pathname.split("/");
    const method = methodPath.reduce((api, key) => api ? api[key] : undefined, api) as any;

    if(method) {
        let responseBody = method(...JSON.parse(UInt8ToStr(body)));

        const isJSON = typeof responseBody !== "string";

        response.mimeType = isJSON ? "application/json" : "text/plain"
        if(responseBody) {
            response.data = strToUint8(isJSON ? JSON.stringify(responseBody) : responseBody)
        }
        else {
            delete response.data
        }
    }
    
    delete requests[requestId];

    return response;
}