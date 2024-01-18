import type fsType from "fs";

declare var fs: typeof fsType

export const api = {
    helloWorld(greeting: string) {
        return {
            message: greeting + " World",
            from: "JS"
        }
    },
    fs: {
        readdir(directory: string) {
            const items = fs.readdirSync(directory || ".", { withFileTypes: true });
            return items.map(item => ({
                ...item,
                isDirectory: typeof item.isDirectory === "function"
                    ? item.isDirectory()
                    : item.isDirectory
            }))
        },
        mkdir(directory: string) {
            fs.mkdirSync(directory, { recursive: true })
        },
        readfile(filename: string) {
            return fs.readFileSync(filename);
        },
        putfile(filename: string, contents: string) {
            fs.writeFileSync(filename, contents);
        },
        deleteItem(itemPath: string) {
            fs.rmSync(itemPath, { recursive: true });
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