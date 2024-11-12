import ipc from "../../src";
import { serializeArgs } from "../../src/serialization";
import { Project } from "../types";
import type { Message } from "esbuild";

export const esbuild = {
    version,
    build
};

// 55
function version() {}

// 56
function build(project: Project): Promise<Message[]> {
    const payload = new Uint8Array([56, ...serializeArgs([project.id])]);

    const transformer = ([jsonStr]) =>
        (JSON.parse(jsonStr) as Message[])
            ?.map(uncapitalizeKeys)
            .map((error) => ({
                ...error,
                location: {
                    ...error.location,
                    file:
                        project.id + error.location.file.split(project.id).pop()
                }
            }));

    return ipc.bridge(payload, transformer);
}

function isPlainObject(input: any) {
    return input && !Array.isArray(input) && typeof input === "object";
}

function uncapitalizeKeys<T>(obj: T) {
    const final = {};
    for (const [key, value] of Object.entries(obj)) {
        final[key.at(0).toLowerCase() + key.slice(1)] = isPlainObject(value)
            ? uncapitalizeKeys(value)
            : value;
    }
    return final as T;
}
