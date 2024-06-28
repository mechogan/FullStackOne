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
            writeFileMulti(files, options) {
                return Promise.all(
                    files.map(({ path, data }) =>
                        writeFile(path, data, options)
                    )
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
                method?: "GET" | "POST" | "PUT" | "DELETE";
                body?: string | Uint8Array;
                encoding?: string;
                timeout?: number;
            }
        ) {
            let signal: AbortSignal = undefined, timeoutId: ReturnType<typeof setTimeout>;
            if(options?.timeout) {
                const controller = new AbortController()
                timeoutId = setTimeout(() => controller.abort(), options.timeout)
                signal = controller.signal
            }

            const response = await fetch(url, {
                method: options?.method || "GET",
                headers: options?.headers || {},
                body: options?.body ? Buffer.from(options?.body) : undefined,
                signal
            });

            if(timeoutId) clearTimeout(timeoutId);

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
