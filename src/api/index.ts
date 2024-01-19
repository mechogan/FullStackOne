import type fsType from "fs";

declare var fs: typeof fsType
declare var homedir: string

export const api = {
    helloWorld(greeting: string) {
        return {
            message: greeting + " World",
            from: "JS"
        }
    },

    fs: {
        readdir(directory: string) {
            const path = homedir + "/" + directory;
            const items = fs.readdirSync(path, { withFileTypes: true });
            return items.map(item => ({
                ...item,
                isDirectory: typeof item.isDirectory === "function"
                    ? item.isDirectory()
                    : item.isDirectory
            }))
        },
        mkdir(directory: string) {
            const path = homedir + "/" + directory;
            fs.mkdirSync(path, { recursive: true })
        },
        readfile(filename: string) {
            const path = homedir + "/" + filename;
            return fs.readFileSync(path).toString();
        },
        putfile(filename: string, contents: string) {
            const path = homedir + "/" + filename;
            fs.writeFileSync(path, contents);
        },
        deleteItem(itemPath: string) {
            const path = homedir + "/" + itemPath;
            fs.rmSync(path, { recursive: true });
        }
    },

    projects: {
        list() {
            return [];
        }
    }
    
}

export default (pathname: string, body: string) => {
    const methodPath = pathname.split("/");
    const method = methodPath.reduce((api, key) => api ? api[key] : undefined, api) as any;

    if(!method)
        return null;

    let responseBody = method(...JSON.parse(body));

    const isJSON = typeof responseBody === "object";

    return {
        data: isJSON ? JSON.stringify(responseBody) : responseBody,
        isJSON
    }
}