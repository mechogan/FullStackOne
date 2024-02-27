import esbuild from "esbuild";
import fs from "fs";
import path from "path";

esbuild.buildSync({
    entryPoints: ["src/index.ts"],
    outfile: "index.js",
    platform: "node",
    format: "esm",
    bundle: true,
    banner: {
        js: "import { createRequire } from 'module';const require = createRequire(import.meta.url);"
    },
    external: ["esbuild"]
});

fs.cpSync(path.resolve("..", "..", "Demo.zip"), "Demo.zip");
fs.cpSync(path.resolve("..", "..", "editor", "build"), "editor", {
    recursive: true
});
fs.cpSync(path.resolve("..", "..", "src", "js"), "js", { recursive: true });
