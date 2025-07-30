
import * as aiAgent from "@fullstacked/ai-agent";
import { z as zod } from "zod";

export * from "@fullstacked/ai-agent";

export const z = zod;

export default {
    ...aiAgent,
    z: zod
}