import type esbuild from "esbuild";

export function build(
    buildSync: typeof esbuild.buildSync,
    input: string,
    out: string,
    outdir: string,
    nodePath: string,
    sourcemap: esbuild.BuildOptions["sourcemap"] = "inline",
    splitting = true
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
            logLevel: "silent"
        });
    } catch (e) {
        return { errors: e.errors as esbuild.ResolveResult["errors"] };
    }
}
