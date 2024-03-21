import fs from "fs";
import type esbuild from "esbuild";

export async function merge(
    baseFile: string,
    entryPoint: string,
    cacheDirectory: string
){
    const mergedContent = `${await fs.promises.readFile(baseFile)}\nimport("${entryPoint}");`;
    await fs.promises.mkdir(cacheDirectory, {recursive: true});
    const tmpFile = `${cacheDirectory}/tmp-${Date.now()}.js`;
    await fs.promises.writeFile(tmpFile, mergedContent);
    return tmpFile;
}

export function build(
    buildSync: typeof esbuild.buildSync,
    entryPoints: {
        in: string,
        out: string
    }[],
    outdir: string,
    nodePaths?: string[],
    sourcemap: esbuild.BuildOptions["sourcemap"] = "inline",
    splitting = true
) {
    try {
        buildSync({
            entryPoints,
            outdir,
            splitting,
            bundle: true,
            format: "esm",
            minify: true,
            sourcemap,
            write: true,
            logLevel: "silent",
            nodePaths
        });
    } catch (e) {
        return { errors: e.errors };
    }
}
