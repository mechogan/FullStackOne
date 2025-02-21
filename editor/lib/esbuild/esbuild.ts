import { bridge } from "../../../lib/bridge";
import {
    deserializeArgs,
    getLowestKeyIdAvailable,
    serializeArgs
} from "../../../lib/bridge/serialization";
import { Project } from "../../types";
import type { Message } from "esbuild";
import core_message from "../../../lib/core_message";
import { toByteArray } from "../../../lib/base64";

// 55
export function version(): Promise<string> {
    const payload = new Uint8Array([55]);
    return bridge(payload, ([str]) => str);
}

let addedListener = false;
const activeBuilds = new Map<
    number,
    { project: Project; resolve: (buildErrors: Message[]) => void }
>();

function buildResponse(buildResult: string) {
    const responseData = toByteArray(buildResult);
    const [id, errorsStr] = deserializeArgs(responseData);
    const activeBuild = activeBuilds.get(id);

    if (!errorsStr) {
        return;
    }

    const errors = JSON.parse(errorsStr);
    const messages = errors?.map(uncapitalizeKeys).map((error) => ({
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

    activeBuilds.delete(id);
}

// 56
export function build(project: Project): Promise<Message[]> {
    if (!addedListener) {
        core_message.addListener("build", buildResponse);
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
        bridge(payload);
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
