import { fetch, fetchRaw } from "./fetch";
import { Dirent, fs } from "./fs";

export type Adapter = {
    fs: fs;
    fetch: fetch;
    fetchRaw: fetchRaw;
    platform: string;
    broadcast(data: string): void;
};

declare global {
    var rpc: () => {
        fetch: Adapter["fetch"],
        fetchRaw: Adapter["fetchRaw"],
        broadcast(data: string): void;
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
    };

    var onPush: {
        [messageType: string]: (message: string) => void;
    };
}
