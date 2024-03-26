import type { Adapter } from "../../../src/adapter";
import fs from "fs";

export function initAdapter(baseDirectory: string, platform = "node"): Adapter {
    return {
        platform,
        fs: {
            readFile: (path, options?: { encoding?: "utf8" }) => {
                return fs.promises.readFile(
                    baseDirectory + "/" + path,
                    options
                );
            },
            writeFile: (file, data, options) => {
                return fs.promises.writeFile(
                    baseDirectory + "/" + file,
                    data,
                    options
                );
            },
            unlink: (path) => {
                return fs.promises.unlink(baseDirectory + "/" + path);
            },
            readdir: async (path, options?: { withFileTypes: true }) => {
                const items = await fs.promises.readdir(
                    baseDirectory + "/" + path,
                    options
                );
                if (!options?.withFileTypes) return items;

                return items.map((item) => ({
                    ...item,
                    isDirectory: item.isDirectory()
                }));
            },
            mkdir: async (path) => {
                await fs.promises.mkdir(baseDirectory + "/" + path, {
                    recursive: true
                });
            },
            rmdir: (path) => {
                return fs.promises.rm(baseDirectory + "/" + path, {
                    recursive: true
                });
            },
            stat: async (path) => {
                const stats: any = await fs.promises.stat(
                    baseDirectory + "/" + path
                );
                stats.isDirectory = stats.isDirectory();
                stats.isFile = stats.isFile();
                return stats;
            },
            lstat: async (path) => {
                const stats: any = await fs.promises.lstat(
                    baseDirectory + "/" + path
                );
                stats.isDirectory = stats.isDirectory();
                stats.isFile = stats.isFile();
                return stats;
            },
            readlink: (path) => {
                throw new Error("Function not implemented.");
            },
            symlink: (path) => {
                throw new Error("Function not implemented.");
            },
            chmod: (path, uid, gid) => {
                throw new Error("Function not implemented.");
            },
            exists: async (path) => {
                try {
                    const stats = await fs.promises.stat(
                        baseDirectory + "/" + path
                    );
                    return { isFile: stats.isFile() };
                } catch (e) {
                    return null;
                }
            }
        },
        async fetch(
            url: string,
            options?: {
                headers?: Record<string, string>;
                method?: "GET" | "POST" | "PUT" | "DELTE";
                body?: string | Uint8Array;
                encoding?: string;
            }
        ) {
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
                headers,
                statusCode: response.status,
                statusMessage: response.statusText,
                body
            };
        }
    };
}

const convertHeadersToObj = (headers: Headers) => {
    let headersObj: Record<string, string> = {};
    headers.forEach(
        (headerValue, headerName) => (headersObj[headerName] = headerValue)
    );
    return headersObj;
};
