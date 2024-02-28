import projects from "./projects";
import config from "./config";
import esbuild from "./esbuild";

import type { fs as globalFS } from "../../src/api";
declare var fs: typeof globalFS;

export default {
    projects,
    fs,
    config,
    esbuild
};
