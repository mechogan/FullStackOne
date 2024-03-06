import type esbuildType from "esbuild";

export function buildWebview(
    entryPoint: string,
    outfile: string,
    nodePath?: string
) {
    if (!global.esbuild) return { errors: "Cannot find esbuild module" };

    try {
        (global.esbuild as typeof esbuildType).buildSync({
            entryPoints: [entryPoint],
            outfile: outfile,
            bundle: true,
            format: "esm",
            sourcemap: "inline",
            write: true,
            logLevel: "silent",
            nodePaths: nodePath ? [nodePath] : undefined
        });
    } catch (e) {
        return { errors: e.errors };
    }
}

export function buildAPI(entryPoint: string, nodePath?: string) {
    if (!global.esbuild) return { errors: "Cannot find esbuild module" };

    let result: esbuildType.BuildResult;
    try {
        result = global.esbuild.buildSync({
            entryPoints: [entryPoint],
            bundle: true,
            globalName: "api",
            format: "iife",
            write: false,
            logLevel: "silent",
            nodePaths: nodePath ? [nodePath] : undefined
        });
    } catch (e) {
        return { errors: e.errors };
    }

    return result?.outputFiles?.at(0)?.text;
}
