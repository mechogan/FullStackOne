import vm from "vm";
import fs from "fs";
import { fs as fsType, Response, fetch as fetchType } from "../../../src/api";

export class JavaScript {
    private requestId = 0;
    ctx = vm.createContext();
    push: (messageType: string, data: string) => void;

    privileged = false;

    constructor(
        logFn: (...args) => void,
        fsdir: string,
        assetdir: string,
        entrypointContents: string,
        platform: string
    ) {
        this.bindFs(fsdir);
        this.bindConsole(logFn);
        this.bindFetch();

        this.ctx.requests = {};
        this.ctx.platform = platform;
        this.ctx.assetdir = assetdir;

        const script = new vm.Script(entrypointContents);
        script.runInContext(this.ctx);
    }

    processRequest(
        headers: { [headerName: string]: string },
        pathname: string,
        body: Uint8Array,
        onCompletion: (jsResponse: Response) => void
    ) {
        const requestId = this.requestId;
        this.requestId += 1;

        this.ctx.requests[requestId] = [headers, pathname, body];

        const script = new vm.Script(`api.default(...requests[${requestId}]);`);
        const cleanup = new vm.Script(`delete requests[${requestId}];`);

        const respond = (jsResponse: Response) => {
            onCompletion(jsResponse);
            cleanup.runInContext(this.ctx);
        };

        script.runInContext(this.ctx).then(respond);
    }

    private bindFs(rootdir: string) {
        const realpath = (path: string) => rootdir + "/" + path;
        const realpathForAsset = (path: string) =>
            this.privileged ? path : realpath(path);

        const ctxFs: typeof fsType = {
            exists(itemPath, forAsset) {
                return fs.existsSync(
                    forAsset ? realpathForAsset(itemPath) : realpath(itemPath)
                );
            },
            mkdir(directory) {
                fs.mkdirSync(realpath(directory), { recursive: true });
            },
            putfile(filename, contents) {
                const uint8arr = new Uint8Array(contents.length);
                contents.forEach((num, i) => (uint8arr[i] = num % 256));
                fs.writeFileSync(realpath(filename), uint8arr);
            },
            putfileUTF8(filename, contents) {
                fs.writeFileSync(realpath(filename), contents);
            },
            readdir(directory) {
                return fs
                    .readdirSync(realpath(directory), { withFileTypes: true })
                    .map((item) => ({
                        name: item.name,
                        isDirectory: item.isDirectory()
                    }));
            },
            readfile(filename, forAsset) {
                return new Uint8Array(
                    fs.readFileSync(
                        forAsset
                            ? realpathForAsset(filename)
                            : realpath(filename)
                    )
                );
            },
            readfileUTF8(filename, forAsset) {
                return fs.readFileSync(
                    forAsset ? realpathForAsset(filename) : realpath(filename),
                    { encoding: "utf-8" }
                );
            },
            rm(itemPath) {
                fs.rmSync(realpath(itemPath), { recursive: true });
            }
        };

        this.ctx.fs = ctxFs;
    }

    private bindConsole(logFn: (...args) => void) {
        this.ctx.console = {
            log: logFn
        };
    }

    private bindFetch() {
        const convertHeadersToObj = (headers: Headers) => {
            let headersObj: Record<string, string> = {};
            headers.forEach(
                (headerValue, headerName) =>
                    (headersObj[headerName] = headerValue)
            );
            return headersObj;
        };

        const fetchObj: typeof fetchType = {
            async data(
                url: string,
                options: {
                    headers?: Record<string, string>;
                    method?: "GET" | "POST" | "PUT" | "DELTE";
                    body?: Uint8Array | number[];
                }
            ) {
                const response = await fetch(url, {
                    method: options?.method || "GET",
                    headers: options?.headers || {},
                    body: options?.body ? Buffer.from(options?.body) : undefined
                });

                const headers = convertHeadersToObj(response.headers);
                return {
                    headers,
                    body: new Uint8Array(await response.arrayBuffer())
                };
            },
            async UTF8(
                url: string,
                options: {
                    headers?: Record<string, string>;
                    method?: "GET" | "POST" | "PUT" | "DELTE";
                    body?: Uint8Array | number[];
                }
            ) {
                const response = await fetch(url, {
                    method: options?.method || "GET",
                    headers: options?.headers || {},
                    body: options?.body ? Buffer.from(options?.body) : undefined
                });

                const headers = convertHeadersToObj(response.headers);
                return {
                    headers,
                    body: await response.text()
                };
            }
        };
        this.ctx.fetch = fetchObj;
    }
}
