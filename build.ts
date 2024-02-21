import fs from "fs";
import path from "path";
import * as sass from "sass";
import { buildAPI, buildWebview } from "./platform/node/src/build";
import { buildSync } from "esbuild";
import { mingleAPI, mingleWebview } from "./editor/api/projects/mingle";
import { scan } from "./editor/api/projects/scan";
import esbuild from "esbuild";

if (fs.existsSync("editor/build"))
    fs.rmSync("editor/build", { recursive: true })

global.fs = {
    readdir: (directory: string) =>  fs.readdirSync(directory, { withFileTypes: true })
        .map(item => ({name: item.name, isDirectory: item.isDirectory()})),
    readfileUTF8: (file: string) => fs.readFileSync(file, { encoding: "utf-8" }),
    putfileUTF8: (file: string, contents: string) => fs.writeFileSync(file, contents),
    exists: (itemPath: string) => fs.existsSync(itemPath),
    mkdir: (itemPath: string) => fs.mkdirSync(itemPath, { recursive: true })
}
global.jsDirectory = "src/js";
global.resolvePath = (entrypoint: string) => entrypoint.split("\\").join("/")
global.esbuild = esbuild

const scssFiles = scan("editor/webview").filter(filePath => filePath.endsWith(".scss"));

const compileScss = async (scssFile: string) => {
    const { css } = await sass.compileAsync(scssFile);
    if (css.length)
        fs.writeFileSync(scssFile.slice(0, -4) + "css", css);
}
const compilePromises = scssFiles.map(compileScss);
await Promise.all(compilePromises);


buildSync({
    entryPoints: ["src/api/index.ts"],
    bundle: true,
    format: "esm",
    outfile: "src/js/api.js"
})

buildSync({
    entryPoints: ["src/webview.ts"],
    bundle: true,
    format: "esm",
    outfile: "src/js/webview.js"
})

const entrypointWebview = mingleWebview("../../editor/webview/index.ts");
buildWebview(entrypointWebview, "editor/build/webview");
fs.rmSync(entrypointWebview);

// cleanup
scssFiles.forEach(scssFile => {
    const cssFile = scssFile.slice(0, -4) + "css";
    if (fs.existsSync(cssFile))
        fs.rmSync(cssFile);
});

fs.cpSync("editor/webview/index.html", "editor/build/webview/index.html");
fs.cpSync("editor/webview/assets", "editor/build/webview/assets", { recursive: true });

const entrypointAPI = mingleAPI(path.resolve("editor/api/index.ts"));
const api = buildAPI(entrypointAPI);
fs.rmSync(entrypointAPI);
fs.mkdirSync("editor/build/api", { recursive: true });
fs.writeFileSync("editor/build/api/index.js", api as string);