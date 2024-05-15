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
            }
        ): Promise<{
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
            }
        ): Promise<{
            headers: Record<string, string>;
            statusCode: number;
            statusMessage: string;
            body: string;
        }>;

        broadcast: (data: string) => void
    };

    var onPush: {
        [messageType: string]: (message: string) => void;
    };
}
