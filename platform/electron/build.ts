import esbuild from "esbuild";
import fs from "fs";
import path from "path";

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

fs.cpSync(path.resolve("..", "..", "dist"), "dist", { recursive: true });
fs.cpSync(path.resolve("..", "..", "src", "js"), "js", { recursive: true });