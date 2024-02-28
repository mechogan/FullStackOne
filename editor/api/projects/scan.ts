import type { fs as globalFS } from "../../../src/api";

declare var fs: typeof globalFS;

const scanRecursive = (
    parent: string,
    item: { name: string; isDirectory: boolean }
) => {
    const itemPath = parent + "/" + item.name;
    if (!item.isDirectory) return itemPath;
    return scan(itemPath);
};

export const scan = (directory: string): string[] => {
    return fs
        .readdir(directory)
        .map((item) => scanRecursive(directory, item))
        .flat();
};
