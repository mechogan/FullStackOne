declare module "fs" {
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
    
    const value: Platform;
    export default value; 
}
