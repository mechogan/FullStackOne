import type esbuild from "esbuild";

export function build(
    buildSync: typeof esbuild.buildSync,
    input: string,
    out: string,
    outdir: string,
    nodePath: string,
    sourcemap: esbuild.BuildOptions["sourcemap"] = "inline",
    splitting = true,
    minify: esbuild.BuildOptions["minify"] = false
) {
    try {
        buildSync({
            entryPoints: [
                {
                    in: input,
                    out
                }
            ],
            outdir,
            splitting,
            bundle: true,
            format: "esm",
            sourcemap,
            write: true,
            nodePaths: nodePath ? [nodePath] : undefined,
            logLevel: "silent",
            minify
        });
    } catch (e) {
        return { errors: e.errors as esbuild.ResolveResult["errors"] };
    }
}
