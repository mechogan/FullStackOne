import { fetch } from "./fetch";
import { Dirent, fs } from "./fs";

export type Adapter = {
    fs: fs;
    fetch: fetch;
    platform: string;
};

declare global {
    var rpc: () => {
        platform: () => Promise<Adapter["platform"]>;
        fs: Omit<Adapter["fs"], "readFile" | "readdir"> & {
            readFile(path: string): Promise<Uint8Array>;
            readFile(
                path: string,
                options: { encoding: "utf8" }
            ): Promise<string>;

            readdir(
                path: string,
                options?: {
                    withFileTypes?: false | undefined;
                    recursive?: boolean;
                }
            ): Promise<string[]>;
            readdir(
                path: string,
                options?: {
                    withFileTypes?: true;
                    recursive?: boolean;
                }
            ): Promise<Dirent[]>;
        };

        fetch(
            url: string,
            options?: {
                headers?: Record<string, string>;
                method?: "GET" | "POST" | "PUT" | "DELTE";
                body?: string | Uint8Array;
            }): Promise<{
                headers: Record<string, string>;
                statusCode: number;
                statusMessage: string;
                body: Uint8Array;
            }>;
        fetch(
            url: string,
            options?: {
                headers?: Record<string, string>;
                method?: "GET" | "POST" | "PUT" | "DELTE";
                body?: string | Uint8Array;
                encoding: "utf8";
            }): Promise<{
                headers: Record<string, string>;
                statusCode: number;
                statusMessage: string;
                body: string;
            }>;
    };

    var rpcSync: () => {
        platform: () => Adapter["platform"];
        fs: {
            readFile(path: string): Uint8Array;
            readFile(path: string, options: { encoding: "utf8" }): string;
            writeFile: Sync<Adapter["fs"]["writeFile"]>;
            writeFileMulti: Sync<Adapter["fs"]["writeFileMulti"]>;
            unlink: Sync<Adapter["fs"]["unlink"]>;

            readdir(
                path: string,
                options?: {
                    withFileTypes?: false | undefined;
                    recursive?: boolean;
                }
            ): string[];
            readdir(
                path: string,
                options?: {
                    withFileTypes?: true;
                    recursive?: boolean;
                }
            ): Dirent[];

            mkdir: Sync<Adapter["fs"]["mkdir"]>;
            rmdir: Sync<Adapter["fs"]["rmdir"]>;
            stat: Sync<Adapter["fs"]["stat"]>;
            lstat: Sync<Adapter["fs"]["lstat"]>;
            readlink: Sync<Adapter["fs"]["readlink"]>;
            symlink: Sync<Adapter["fs"]["symlink"]>;
            chmod: Sync<Adapter["fs"]["chmod"]>;
            exists: Sync<Adapter["fs"]["exists"]>;
        };
        fetch(
            url: string,
            options?: {
                headers?: Record<string, string>;
                method?: "GET" | "POST" | "PUT" | "DELTE";
                body?: string | Uint8Array;
            }): {
                headers: Record<string, string>;
                statusCode: number;
                statusMessage: string;
                body: Uint8Array;
            };
        fetch(
            url: string,
            options?: {
                headers?: Record<string, string>;
                method?: "GET" | "POST" | "PUT" | "DELTE";
                body?: string | Uint8Array;
                encoding: "utf8";
            }): {
                headers: Record<string, string>;
                statusCode: number;
                statusMessage: string;
                body: string;
            };
    };

    var onPush: {
        [messageType: string]: (message: string) => void;
    };
}

type Sync<T extends (...args: any) => any> = (
    ...args: T extends (...args: infer P) => any ? P : never[]
) => Awaited<ReturnType<T>>;
