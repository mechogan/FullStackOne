import fs from "fs";
import esbuild from "esbuild";

if (fs.existsSync("bin")) {
    fs.rmSync("bin", { recursive: true });
}
fs.mkdirSync("bin");

fs.cpSync("../../core/bin/wasm.wasm", "bin/wasm.wasm");
fs.cpSync("../../core/bin/wasm.js", "bin/wasm.js");

const editorZipFileName = fs
    .readdirSync("../../out/zip")
    .find((item) => item.startsWith("editor"));
fs.cpSync(`../../out/zip/${editorZipFileName}`, "editor.zip");

esbuild.buildSync({
    entryPoints: ["src/index.ts"],
    outfile: "index.js",
    bundle: true,
    format: "esm"
});
