import fs from "./fs";
import projects from "./projects";

export const api = {
    helloWorld(greeting: string) {
        return {
            message: greeting + " World",
            from: "JS"
        }
    },
    fs,
    projects
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