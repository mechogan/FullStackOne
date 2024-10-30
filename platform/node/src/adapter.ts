import { fromByteArray } from "base64-js";
import type { Adapter } from "../../../src/adapter/fullstacked";
import fs from "fs";

export function createAdapter(
    baseDirectory: string,
    platform: string,
    broadcast: Adapter["broadcast"]
): Adapter {
    const writeFile: Adapter["fs"]["writeFile"] = async (
        file,
        data,
        options
    ) => {
        const filePath = baseDirectory + "/" + file;

        if (options?.recursive) {
            const directory = filePath.split("/").slice(0, -1);
            await fs.promises.mkdir(directory.join("/"), { recursive: true });
        }

        return fs.promises.writeFile(baseDirectory + "/" + file, data, options);
    };

    const existsAndIsFile = async (path: string) => {
        try {
            const stats = await fs.promises.stat(baseDirectory + "/" + path);
            return { isFile: stats.isFile() };
        } catch (e) {
            return null;
        }
    };

    return {
        platform,
        fs: {
            readFile: async (
                path: string,
                options?: { encoding?: "utf8"; absolutePath?: boolean }
            ) => {
                return fs.promises.readFile(
                    baseDirectory + "/" + path,
                    options
                );
            },
            writeFile,
            writeFileMulti(options, ...files) {
                const promises = [];
                for (let i = 0; i < files.length; i += 2) {
                    promises.push(writeFile(files[i] as string, files[i + 1], options))
                }
                return Promise.all(promises);
            },
            unlink: (path) => {
                return fs.promises.unlink(baseDirectory + "/" + path);
            },
            readdir: async (path, options?: { withFileTypes: true }) => {
                const items = await fs.promises.readdir(
                    baseDirectory + "/" + path,
                    options
                );
                if (!options?.withFileTypes) {
                    return (items as unknown as string[]).map((filename) =>
                        filename.split("\\").join("/")
                    );
                }

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
                const dirPath = baseDirectory + "/" + path;

                if (!fs.existsSync(dirPath)) return;

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
            exists: existsAndIsFile,
            rename: async (oldPath, newPath) => {
                if (oldPath === newPath) return;

                const exists = await existsAndIsFile(newPath);

                oldPath = baseDirectory + "/" + oldPath;
                newPath = baseDirectory + "/" + newPath;

                if (typeof exists?.isFile === "boolean") {
                    console.log("deleting");
                    await fs.promises.rm(newPath, {
                        recursive: true,
                        force: true
                    });
                }

                return fs.promises.rename(oldPath, newPath);
            }
        },
        async fetch(
            url,
            body,
            options
        ) {
            let signal: AbortSignal = undefined,
                timeoutId: ReturnType<typeof setTimeout>;
            if (options?.timeout) {
                const controller = new AbortController();
                timeoutId = setTimeout(
                    () => controller.abort(),
                    options.timeout
                );
                signal = controller.signal;
            }

            const response = await fetch(url, {
                method: options?.method || "GET",
                headers: options?.headers || {},
                body: body ? Buffer.from(body) : undefined,
                signal
            });

            if (timeoutId) clearTimeout(timeoutId);

            const headers = convertHeadersToObj(response.headers);

            const responseBody = options?.encoding === "base64"
                ? fromByteArray(new Uint8Array(await response.arrayBuffer()))
                : await response.text();

            return {
                headers,
                statusCode: response.status,
                statusMessage: response.statusText,
                body: responseBody
            };
        },
        fetchRaw: async (url: string,
            body?: string | Uint8Array,
            options?: {
                headers?: Record<string, string>;
                method?: "GET" | "POST" | "PUT" | "DELETE";
                timeout?: number;
            }) => {
                let signal: AbortSignal = undefined,
                timeoutId: ReturnType<typeof setTimeout>;
            if (options?.timeout) {
                const controller = new AbortController();
                timeoutId = setTimeout(
                    () => controller.abort(),
                    options.timeout
                );
                signal = controller.signal;
            }

            const response = await fetch(url, {
                method: options?.method || "GET",
                headers: options?.headers || {},
                body: body ? Buffer.from(body) : undefined,
                signal
            });

            if (timeoutId) clearTimeout(timeoutId);

            return new Uint8Array(await response.arrayBuffer());
        },

        broadcast
    };
}

const convertHeadersToObj = (headers: Headers) => {
    let headersObj: Record<string, string> = {};
    headers.forEach(
        (headerValue, headerName) => (headersObj[headerName] = headerValue)
    );
    return headersObj;
};
