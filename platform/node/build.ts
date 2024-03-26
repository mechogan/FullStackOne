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

const editorOut = "editor";
if (fs.existsSync(editorOut)) {
    fs.rmSync(editorOut, { recursive: true });
}

fs.cpSync(path.resolve("..", "..", "editor", "build"), editorOut, {
    recursive: true
});
fs.cpSync(path.resolve("..", "..", "src", "js"), "js", { recursive: true });

fs.cpSync(
    path.resolve("..", "..", "Demo.zip"),
    path.resolve("editor", "Demo.zip")
);
