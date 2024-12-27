declare module "fs" {
    export type FileInfo = {
        name: string;
        isDirectory: boolean;
    };
    export type FileStats = {
        name: string;
        size: number;
        modTime: number;
        isDirectory: boolean;
    }

    export function readFile(path: string): Promise<Uint8Array>;
    export function readFile(path: string, options: {
        encoding: "utf8";
    }): Promise<string>;
    export function writeFile(path: string, data: string | Uint8Array): Promise<boolean>;
    export function unlink(path: string): Promise<boolean>;
    export function readdir(path: string, options?: {
        recursive?: boolean;
        withFileTypes?: false;
    }): Promise<string[]>;
    export function readdir(path: string, options?: {
        recursive?: boolean;
        withFileTypes: true;
    }): Promise<FileInfo[]>;
    export function mkdir(path: string): Promise<boolean>;
    export function rmdir(path: string): Promise<boolean>;
    export function exists(path: string): Promise<{
        isFile: boolean;
    }>;
    export function rename(oldPath: string, newPath: string): Promise<boolean>;
    export function stat(path: string): Promise<FileStats>;

    var fs: {
        readFile(path: string): Promise<Uint8Array>;
        readFile(path: string, options: {
            encoding: "utf8";
        }): Promise<string>;
        writeFile(path: string, data: string | Uint8Array): Promise<boolean>;
        unlink(path: string): Promise<boolean>;
        readdir(path: string, options?: {
            recursive?: boolean;
            withFileTypes?: false;
        }): Promise<string[]>;
        readdir(path: string, options?: {
            recursive?: boolean;
            withFileTypes: true;
        }): Promise<FileInfo[]>;
        mkdir(path: string): Promise<boolean>;
        rmdir(path: string): Promise<boolean>;
        exists(path: string): Promise<{
            isFile: boolean;
        }>;
        rename(oldPath: string, newPath: string): Promise<boolean>;
        stat(path: string): Promise<FileStats>;
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
