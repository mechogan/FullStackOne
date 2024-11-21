export enum Platform {
    NODE = "node",
    IOS = "ios",
    ANDROID = "android",
    ELECTRON = "electron",
    DOCKER = "docker",
    WINDOWS = "windows",
    WASM = "wasm"
}

declare global {
    var platform: Platform;
    var ipc: ipcMethods;
    var addCoreMessageListener: (
        messageType: string,
        cb: (message: string) => void
    ) => void;
    var removeCoreMessageListener: (
        messageType: string,
        cb: (message: string) => void
    ) => void;
}

export type ipcMethods = {
    fs: fs;
    fetch: http["fetch"];
};

export type Dirent = {
    name: string;
    isDirectory: boolean;
};

type fs = {
    readFile(path: string): Promise<Uint8Array>;
    readFile(path: string, options: { encoding: "utf8" }): Promise<string>;

    writeFile(path: string, data: string | Uint8Array): Promise<boolean>;

    unlink(path: string): Promise<boolean>;

    readdir(
        path: string,
        options?: { recursive?: boolean; withFileTypes?: false }
    ): Promise<string[]>;
    readdir(
        path: string,
        options?: { recursive?: boolean; withFileTypes: true }
    ): Promise<Dirent[]>;

    mkdir(path: string): Promise<boolean>;

    rmdir(path: string): Promise<boolean>;

    exists(path: string): Promise<{ isFile: boolean }>;

    rename(oldPath: string, newPath: string): Promise<boolean>;

    stat(path: string): Promise<{
        name: string;
        size: number;
        modTime: number;
        isDirectory: boolean;
    }>;
};

export type FetchOptions = {
    method: "GET" | "POST" | "PUT" | "DELETE";
    headers: Record<string, string>;
    body: string | Uint8Array;
    timeout: number;
};

export type FetchResponse = {
    statusCode: number;
    statusMessage: string;
    headers: Record<string, string>;
};

type http = {
    fetch(
        url: string,
        options?: Partial<FetchOptions>
    ): Promise<FetchResponse & { body: Uint8Array }>;
    fetch(
        url: string,
        options?: Partial<FetchOptions> & { encoding: "utf8" }
    ): Promise<FetchResponse & { body: string }>;
};
