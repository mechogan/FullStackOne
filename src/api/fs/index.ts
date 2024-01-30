import type fsType from "fs";

declare var fs: typeof fsType
declare var workdir: string

const realPath = (itemPath: string) => workdir + "/" + itemPath;

export default {
    exists(itemPath: string) {
        return fs.existsSync(realPath(itemPath));
    },
    readdir(directory: string) {
        const items = fs.readdirSync(realPath(directory), { withFileTypes: true });
        return items.map(item => ({
            ...item,
            isDirectory: typeof item.isDirectory === "function"
                ? item.isDirectory()
                : item.isDirectory
        }))
    },
    mkdir(directory: string) {
        fs.mkdirSync(realPath(directory), { recursive: true })
    },
    readfile(filename: string) {
        return fs.readFileSync(realPath(filename)).toString();
    },
    putfile(filename: string, contents: string) {
        fs.writeFileSync(realPath(filename), contents);
    },
    deleteItem(itemPath: string) {
        fs.rmSync(realPath(itemPath), { recursive: true });
    }
}