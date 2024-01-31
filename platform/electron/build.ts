import esbuild from "esbuild";

esbuild.buildSync({
    entryPoints: ["index.ts"],
    outfile: ".cache/index.js",
    platform: "node",
    bundle: true,
    loader: {
        ".txt": "text"
    },
    external: ["esbuild", "electron"]
});