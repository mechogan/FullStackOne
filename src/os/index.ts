import type fs from "fs";

var globalFs: typeof fs

const api = {
    readdir(directory: string) {
        const items = globalFs.readdirSync(directory, { withFileTypes: true });
        return items.map(item => ({
            ...items,
            isDirectory: typeof item.isDirectory === "function"
                ? item.isDirectory()
                : item.isDirectory
        }))
    },
    readfile(filename: string) {
        return globalFs.readFileSync(filename);
    },
    putfile(filename: string, contents: string) {
        return globalFs.writeFileSync(filename, contents);
    },
    deleteItem(itemPath: string) {
        return globalFs.rmSync(itemPath, { recursive: true });
    }
}

