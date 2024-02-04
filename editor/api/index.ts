import projects from "./projects";

import type { fs as globalFS} from "../../src/api";
declare var fs: typeof globalFS;

console.log("ICI")

export default {
    projects,
    fs
}