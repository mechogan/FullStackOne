import ipc from "../../src";
import { serializeArgs } from "../../src/serialization";
import { Project } from "../types";
import type { Message } from "esbuild"

export const esbuild = {
    version,
    build
}

// 55
function version(){

}

// 56
function build(project: Project) : Promise<Message>{
    const payload = new Uint8Array([
        56,
        ...serializeArgs([project.id])
    ]);

    const transformer = ([jsonStr]) => JSON.parse(jsonStr)
    
    return ipc.bridge(payload, transformer)
}