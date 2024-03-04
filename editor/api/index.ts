import projects from "./projects";
import config from "./config";
import esbuild from "./esbuild";
import packages from "./packages";

import type { fs as globalFS } from "../../src/api/fs";
declare var fs: typeof globalFS;

export default {
    projects,
    fs,
    config,
    esbuild,
    packages
};
