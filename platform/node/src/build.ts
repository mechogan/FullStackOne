import esbuild from "esbuild";
import path from "path";

export function buildWebview(entryPoint: string, outdir: string) {
    esbuild.buildSync({
        entryPoints: [entryPoint],
        outfile: path.join(outdir, "index.js"),
        bundle: true,
        format: "esm",
        write: true
    });
}

export function buildAPI(entryPoint: string) {
    const result = esbuild.buildSync({
        entryPoints: [entryPoint],
        bundle: true,
        globalName: "api",
        format: "iife",
        write: false
    });
    return result.outputFiles?.at(0)?.text;
}
