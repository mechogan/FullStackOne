import { ipc } from ".";
import { serializeArgs } from "../serialization";

export const fs = {
    readFile,
    writeFile,
    // unlink
    readdir,
    mkdir,
    // rmdir
    // exists
    rename
}

const te = new TextEncoder();

// 2
function readFile(path: string): Promise<Uint8Array>;
function readFile(path: string, options: { encoding: "utf8" }): Promise<string>;
function readFile(
    path: string,
    options?: { encoding: "utf8" }
): Promise<string | Uint8Array> {
    const payload = new Uint8Array([
        2,
        ...serializeArgs([path, options?.encoding === "utf8"])
    ]);

    const transformer = ([stringOrBuffer]) => stringOrBuffer;

    return ipc.bridge(payload, transformer);
}

// 3
function writeFile(path: string, data: string | Uint8Array): Promise<boolean> {
    if (typeof data === "string") {
        data = te.encode(data);
    }

    const payload = new Uint8Array([3, ...serializeArgs([path, data])]);

    return ipc.bridge(payload, ([success]) => success);
}

// 4

type Dirent = {
    name: string;
    isDirectory: boolean;
};

// 5
function readdir(
    path: string,
    options?: { recursive?: boolean; withFileTypes?: false }
): Promise<string[]>;
function readdir(
    path: string,
    options?: { recursive?: boolean; withFileTypes: true }
): Promise<Dirent[]>;
function readdir(
    path: string,
    options?: { recursive?: boolean; withFileTypes?: boolean }
): Promise<string[] | Dirent[]> {
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
    const payload = new Uint8Array([
        6,
        ...serializeArgs([path])
    ]);

    return ipc.bridge(payload, ([success]) => success);
}

// 9
function rename(oldPath: string, newPath: string) {
    const payload = new Uint8Array([
        9,
        ...serializeArgs([oldPath, newPath])
    ]);

    return ipc.bridge(payload, ([success]) => success);
}