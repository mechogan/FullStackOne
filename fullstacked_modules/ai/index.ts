
import * as aiAgent from "@fullstacked/ai-agent";
import { z as zod } from "zod";
import fs from "./tools/fs"

export * from "@fullstacked/ai-agent";

export const z = zod;

export const tools = {
    fs
}

export default {
    ...aiAgent,
    tools,
    z: zod
}