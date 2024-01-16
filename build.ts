import { buildSync } from "esbuild";
import fs from "fs";
import * as sass from "sass";

if(fs.existsSync("dist"))
    fs.rmSync("dist", { recursive: true });

buildSync({
    entryPoints: ["src/webview/script.ts"],
    outfile: "dist/webview/script.js",
    bundle: true,
    format: "esm"
});

fs.cpSync("src/webview/index.html", "dist/webview/index.html");
fs.cpSync("src/webview/assets", "dist/webview/assets", {recursive: true});
fs.writeFileSync("dist/webview/style.css", sass.compile("src/webview/style.scss").css);