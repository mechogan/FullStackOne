import projects from "./projects";

import type { fs as globalFS} from "../../src/api";
declare var fs: typeof globalFS;

export default {
    projects,
    fs
}