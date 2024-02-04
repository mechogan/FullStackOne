import esbuild from "esbuild";

esbuild.buildSync({
    entryPoints: ["src/index.ts"],
    outfile: ".cache/index.js",
    platform: "node",
    format: "esm",
    bundle: true,
    banner: {
        js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);"
    },
    external: ["esbuild"]
})