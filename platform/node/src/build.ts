import type esbuildType from "esbuild";
import path from "path";
import fs from "fs";

export function buildWebview(entryPoint: string, outdir: string) {
    if (!global.esbuild) return { errors: "Cannot find esbuild module" };

    try {
        global.esbuild.buildSync({
            entryPoints: [entryPoint],
            outfile: path.join(outdir, "index.js"),
            bundle: true,
            format: "esm",
            sourcemap: "inline",
            write: true,
            logLevel: "silent"
        });
    } catch (e) {
        return { errors: e.errors };
    }
}

export function buildAPI(entryPoint: string) {
    if (!global.esbuild) return { errors: "Cannot find esbuild module" };

    let result: esbuildType.BuildResult;
    try {
        result = global.esbuild.buildSync({
            entryPoints: [entryPoint],
            bundle: true,
            globalName: "api",
            format: "iife",
            write: false,
            logLevel: "silent"
        });
    } catch (e) {
        return { errors: e.errors };
    }

    return result?.outputFiles?.at(0)?.text;
}
