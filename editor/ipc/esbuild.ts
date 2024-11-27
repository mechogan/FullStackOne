import ipc from "../../src";
import {
    deserializeArgs,
    getLowestKeyIdAvailable,
    serializeArgs
} from "../../src/serialization";
import { fromBase64 } from "../api/connectivity/cryptoUtils";
import { Project } from "../types";
import type { Message } from "esbuild";

export const esbuild = {
    version,
    build
};

// 55
function version(): Promise<string> {
    const payload = new Uint8Array([55]);
    return ipc.bridge(payload, ([str]) => str);
}

let addedListener = false;
const activeBuilds = new Map<
    number,
    { project: Project; resolve: (buildErrors: Message[]) => void }
>();

function buildResponse(responseBase64: string) {
    const responseData = fromBase64(responseBase64);
    const [buildId, buildErrors] = deserializeArgs(responseData);
    const activeBuild = activeBuilds.get(buildId);
    activeBuilds.delete(buildId);

    if (!buildErrors) {
        activeBuild.resolve(null);
        return;
    }

    const json = JSON.parse(buildErrors);
    if (!json) {
        activeBuild.resolve(null);
        return;
    }

    const messages = json.map(uncapitalizeKeys).map((error) => ({
        ...error,
        location: error.location
            ? {
                  ...error.location,
                  file: error.location.file.includes(activeBuild.project.id)
                      ? activeBuild.project.id +
                        error.location.file.split(activeBuild.project.id).pop()
                      : error.location.file
              }
            : null
    }));
    activeBuild.resolve(messages);
}

// 56
function build(project: Project): Promise<Message[]> {
    if (!addedListener) {
        addCoreMessageListener("build", buildResponse);
        addedListener = true;
    }

    const buildId = getLowestKeyIdAvailable(activeBuilds);
    const payload = new Uint8Array([
        56,
        ...serializeArgs([project.id, buildId])
    ]);

    return new Promise((resolve) => {
        activeBuilds.set(buildId, {
            project,
            resolve
        });
        ipc.bridge(payload);
    });
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
