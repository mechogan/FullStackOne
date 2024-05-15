import type { Adapter } from "../../../src/adapter/fullstacked";
import { Dirent } from "../../../src/adapter/fs";

export const scan = async (
    directory: string,
    scanFn: Adapter["fs"]["readdir"]
): Promise<string[]> => {
    const items = (await scanFn(directory, {
        withFileTypes: true
    })) as Dirent[];
    const itemsChilds = await Promise.all(
        items.map((item) => {
            const path = directory + "/" + item.name;
            const isDirectory =
                typeof item.isDirectory === "function"
                    ? item.isDirectory()
                    : item.isDirectory;
            return isDirectory ? scan(path, scanFn) : path;
        })
    );
    return itemsChilds.flat();
};
