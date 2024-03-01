import projects from "./projects";
import config from "./config";
import esbuild from "./esbuild";
import npm from "./npm";

import type { fs as globalFS } from "../../src/api/fs";
declare var fs: typeof globalFS;

export default {
    projects,
    fs,
    config,
    esbuild,
    npm
};
