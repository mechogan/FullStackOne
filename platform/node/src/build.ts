import esbuild, { BuildResult } from "esbuild";
import path from "path";

export function buildWebview(entryPoint: string, outdir: string) {
    try {
        esbuild.buildSync({
            entryPoints: [entryPoint],
            outfile: path.join(outdir, "index.js"),
            bundle: true,
            format: "esm",
            write: true,
            logLevel: "silent"
        });
    } catch (e) {
        return { errors: e.errors }
    }
}

export function buildAPI(entryPoint: string) {
    let result: BuildResult;
    try {
        result = esbuild.buildSync({
            entryPoints: [entryPoint],
            bundle: true,
            globalName: "api",
            format: "iife",
            write: false,
            logLevel: "silent"
        });
    } catch (e) {
        return { errors: e.errors }
    }


    return result?.outputFiles?.at(0)?.text;
}
