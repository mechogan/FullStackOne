declare module "fs" {
    export function readFile<T>(path: string, options?: T): Promise<T extends { encoding: "utf8" } ? string : Uint8Array>;
    export function writeFile(path: string, data: string | Uint8Array): Promise<boolean>;
    export function unlink(path: string): Promise<boolean>;
    export function readdir(path: string, options?: {
        recursive?: boolean;
        withFileTypes?: false;
    }): Promise<string[]>;
    export function readdir(path: string, options?: {
        recursive?: boolean;
        withFileTypes: true;
    }): Promise<Dirent[]>;
    export function mkdir(path: string): Promise<boolean>;
    export function rmdir(path: string): Promise<boolean>;
    export function exists(path: string): Promise<{
        isFile: boolean;
    }>;
    export function rename(oldPath: string, newPath: string): Promise<boolean>;
    export function stat(path: string): Promise<{
        name: string;
        size: number;
        modTime: number;
        isDirectory: boolean;
    }>;
    var fs: {
        readfile: typeof readFile,
        writeFile: typeof writeFile
        unlink: typeof unlink
        readdir: typeof readdir
        mkdir: typeof mkdir
        rmdir: typeof rmdir
        exists: typeof exists
        rename: typeof rename
        stat: typeof stat
    }
    export default fs;
}

type FetchOptions = {
    method: "GET" | "POST" | "PUT" | "DELETE";
    headers: Record<string, string>;
    body: string | Uint8Array;
    timeout: number;
};

type FetchResponse = {
    statusCode: number;
    statusMessage: string;
    headers: Record<string, string>;
};

declare module "fetch" {
    export default function core_fetch(
        url: string,
        options?: Partial<FetchOptions>
    ): Promise<FetchResponse & { body: Uint8Array }>;
    export default function core_fetch(
        url: string,
        options?: Partial<FetchOptions> & { encoding: "utf8" }
    ): Promise<FetchResponse & { body: string }>;
}

declare module "platform" {
    export enum Platform {
        NODE = "node",
        APPLE = "apple",
        ANDROID = "android",
        DOCKER = "docker",
        WINDOWS = "windows",
        WASM = "wasm"
    }

    const platform: Platform;
    export default platform;
}
