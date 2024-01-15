import { buildSync } from "esbuild";
import fs from "fs";
import * as sass from "sass";

if(fs.existsSync("dist"))
    fs.rmSync("dist", { recursive: true });

buildSync({
    entryPoints: ["src/script.ts"],
    outfile: "dist/script.js",
    bundle: true
});

fs.cpSync("src/index.html", "dist/index.html");
fs.cpSync("src/assets", "dist/assets", {recursive: true});
fs.writeFileSync("dist/style.css", sass.compile("src/style.scss").css);