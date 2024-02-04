import { buildSync } from "esbuild";
import path from "path";

export function buildWebview(entryPoint: string, outdir: string) {
    buildSync({
        entryPoints: [entryPoint],
        outfile: path.join(outdir, "index.js"),
        bundle: true,
        format: "esm"
    });
}

export function buildAPI(entryPoint: string) {
    const result = buildSync({
        entryPoints: [entryPoint],
        bundle: true,
        globalName: "api",
        format: "iife",
        write: false
    });
    return result.outputFiles?.at(0)?.text;
}
