import vm from "vm";
import fs from "fs";
import { Response } from "../../../src/api";
import type { fs as fsType } from "../../../src/api/fs";
import type { fetch as fetchType } from "../../../src/api/fetch";

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
        const realpathWithAbsolutePath = (path: string) =>
            this.privileged ? path : realpath(path);

        const exists = async (
            path: string,
            options?: { absolutePath?: boolean }
        ) => {
            path = options?.absolutePath
                ? realpathWithAbsolutePath(path)
                : realpath(path);

            try {
                return await fs.promises.stat(path);
            } catch (e) {}

            return false;
        };

        const ctxFs: typeof fsType = {
            async readFile(path, options) {
                path = options?.absolutePath
                    ? realpathWithAbsolutePath(path)
                    : realpath(path);

                if (options?.encoding === "utf8") {
                    return fs.promises.readFile(path, { encoding: "utf8" });
                }

                const data = await fs.promises.readFile(path);
                return new Uint8Array(data);
            },

            writeFile(file, data) {
                file = realpath(file);

                if (Array.isArray(data)) {
                    const uint8arr = new Uint8Array(data.length);
                    data.forEach((num, i) => (uint8arr[i] = num % 256));
                    data = uint8arr;
                }

                return fs.promises.writeFile(file, data);
            },

            unlink(path) {
                path = realpath(path);

                return fs.promises.unlink(path);
            },

            async readdir(path, options) {
                path = realpath(path);

                if (options?.withFileTypes) {
                    const items = await fs.promises.readdir(path, {
                        withFileTypes: true
                    });
                    return items.map((item) => ({
                        name: item.name,
                        isDirectory: item.isDirectory()
                    }));
                }

                return fs.promises.readdir(path);
            },

            async mkdir(path) {
                path = realpath(path);

                await fs.promises.mkdir(path, { recursive: true });
            },

            async rmdir(path) {
                // node throws a lstat error if doesn't exists
                if (!(await exists(path))) return;

                path = realpath(path);
                return fs.promises.rm(path, { recursive: true });
            },
            stat(path) {
                path = realpath(path);

                return fs.promises.stat(path);
            },
            lstat(path) {
                path = realpath(path);

                return fs.promises.lstat(path);
            },
            exists: async (path, options) => !!(await exists(path, options)),
            async isFile(path, options) {
                const maybeStats = await exists(path, options);
                if (!maybeStats) return false;
                return maybeStats.isFile();
            },
            async isDirectory(path, options) {
                const maybeStats = await exists(path, options);
                if (!maybeStats) return false;
                return maybeStats.isDirectory();
            },

            readlink(path: string) {
                throw Error("not implemeted");
            },
            symlink(path: string) {
                throw Error("not implemeted");
            },
            chmod(path: string, uid: number, gid: number) {
                throw Error("not implemented");
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

        const fetchMethod: typeof fetchType = async (
            url: string,
            options: {
                headers?: Record<string, string>;
                method?: "GET" | "POST" | "PUT" | "DELTE";
                body?: string | Uint8Array;
                encoding?: string;
            }
        ) => {
            const response = await fetch(url, {
                method: options?.method || "GET",
                headers: options?.headers || {},
                body: options?.body ? Buffer.from(options?.body) : undefined
            });

            const headers = convertHeadersToObj(response.headers);

            const body =
                options?.encoding === "utf8"
                    ? await response.text()
                    : new Uint8Array(await response.arrayBuffer());

            return {
                url,
                headers,
                method: options?.method || "GET",
                statusCode: response.status,
                statusMessage: response.statusText,
                body
            };
        };

        this.ctx.fetch = fetchMethod;
    }
}
