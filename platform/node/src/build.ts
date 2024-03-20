import type esbuildType from "esbuild";

export function buildWebview(
    entryPoint: string,
    outdir: string,
    nodePath?: string,
    splitting = true
) {
    if (!global.esbuild) return { errors: "Cannot find esbuild module" };

    try {
        (global.esbuild as typeof esbuildType).buildSync({
            entryPoints: [{ out: "index", in: entryPoint }],
            outdir,
            splitting,
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
