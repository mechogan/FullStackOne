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
}

export type ipcMethods = {
    fs: fs;
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
