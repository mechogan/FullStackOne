import type { fs as globalFS } from "../../../src/adapter/fs";

declare var fs: typeof globalFS;

const scanRecursive = (
    parent: string,
    item: { name: string; isDirectory: boolean }
) => {
    const itemPath = parent + "/" + item.name;
    if (!item.isDirectory) return itemPath;
    return scan(itemPath);
};

export const scan = async (directory: string): Promise<string[]> => {
    const items = await fs.readdir(directory, { withFileTypes: true });
    const itemsChilds = await Promise.all(
        items.map((item) => scanRecursive(directory, item))
    );
    return itemsChilds.flat();
};
