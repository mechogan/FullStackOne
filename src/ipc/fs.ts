import { ipc } from ".";
import { ipcMethods } from "../fullstacked";
import { serializeArgs } from "../serialization";

export const fs: ipcMethods["fs"] = {
    readFile,
    writeFile,
    unlink,
    readdir,
    mkdir,
    rmdir,
    exists,
    rename,
    stat
};

const te = new TextEncoder();

// 2
function readFile(path: string, options?: { encoding: "utf8" }) {
    const payload = new Uint8Array([
        2,
        ...serializeArgs([path, options?.encoding === "utf8"])
    ]);

    const transformer = ([stringOrBuffer]) => stringOrBuffer;

    return ipc.bridge(payload, transformer);
}

// 3
function writeFile(path: string, data: string | Uint8Array) {
    if (typeof data === "string") {
        data = te.encode(data);
    }

    const payload = new Uint8Array([3, ...serializeArgs([path, data])]);

    return ipc.bridge(payload, ([success]) => success);
}

// 4
function unlink(path: string) {
    const payload = new Uint8Array([4, ...serializeArgs([path])]);

    return ipc.bridge(payload, ([success]) => success);
}

type Dirent = {
    name: string;
    isDirectory: boolean;
};

// 5
function readdir(
    path: string,
    options?: { recursive?: boolean; withFileTypes?: boolean }
) {
    const payload = new Uint8Array([
        5,
        ...serializeArgs([path, !!options?.recursive, !!options?.withFileTypes])
    ]);

    const transformer = (items: string[] | (string | boolean)[]) => {
        if (options?.withFileTypes) {
            const dirents: Dirent[] = [];
            for (let i = 0; i < items.length; i = i + 2) {
                dirents.push({
                    name: items[i] as string,
                    isDirectory: items[i + 1] as boolean
                });
            }
            return dirents;
        }

        return items;
    };

    return ipc.bridge(payload, transformer);
}

// 6
function mkdir(path: string) {
    const payload = new Uint8Array([6, ...serializeArgs([path])]);

    return ipc.bridge(payload, ([success]) => success);
}

// 7
function rmdir(path: string) {
    const payload = new Uint8Array([7, ...serializeArgs([path])]);

    return ipc.bridge(payload, ([success]) => success);
}

// 8
function exists(path: string) {
    const payload = new Uint8Array([8, ...serializeArgs([path])]);

    const transformer = ([exists, isFile]: [boolean, boolean]) => {
        if (!exists) return undefined;
        return { isFile };
    };

    return ipc.bridge(payload, transformer);
}

// 9
function rename(oldPath: string, newPath: string) {
    const payload = new Uint8Array([9, ...serializeArgs([oldPath, newPath])]);

    return ipc.bridge(payload, ([success]) => success);
}

// 10
function stat(path: string) {
    const payload = new Uint8Array([10, ...serializeArgs([path])]);

    const transformer = (responseArgs: any[]) => {
        if (!responseArgs.length) return null;

        const [name, size, modTime, isDirectory] = responseArgs;

        return {
            name,
            size,
            modTime,
            isDirectory
        };
    };

    return ipc.bridge(payload, transformer);
}
