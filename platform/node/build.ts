import esbuild from "esbuild";
import fs from "fs";
import path from "path";

const editorOut = "editor";

fs.cpSync(path.resolve("..", "..", "editor", "build"), editorOut, {
    recursive: true
});

fs.cpSync(path.resolve("..", "..", "core", "bin"), "bin", {
    recursive: true,
    force: true
});

esbuild.buildSync({
    entryPoints: ["src/index.ts"],
    outfile: "index.js",
    bundle: true,
    format: "esm",
    packages: "external",
    platform: "node"
});
