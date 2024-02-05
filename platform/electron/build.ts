import esbuild from "esbuild";

esbuild.buildSync({
    entryPoints: ["src/index.ts"],
    outfile: ".cache/index.js",
    platform: "node",
    bundle: true,
    loader: {
        ".txt": "text"
    },
    external: ["esbuild", "electron"]
});