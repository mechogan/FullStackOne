import fs from "fs";
import path from "path";
import * as sass from "sass";
import { build, merge } from "./platform/node/src/build";
import { scan } from "./editor/api/projects/scan";
import esbuild from "esbuild";
import zip from "./editor/api/projects/zip";

const baseFile = "src/js/index.js";

esbuild.buildSync({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "esm",
    outfile: baseFile
});


if (fs.existsSync("editor/build"))
    fs.rmSync("editor/build", { recursive: true });


const scssFiles = (await scan("editor", fs.promises.readdir as any)).filter((filePath) =>
    filePath.endsWith(".scss")
);

const compileScss = async (scssFile: string) => {
    const { css } = await sass.compileAsync(scssFile);
    if (css.length) fs.writeFileSync(scssFile.slice(0, -4) + "css", css);
};
const compilePromises = scssFiles.map(compileScss);
await Promise.all(compilePromises);

const editorEntry = await merge(baseFile, path.resolve("editor/index.ts"), ".cache");
const buildErrors = build(
    esbuild.buildSync, 
    editorEntry,
    "index",
    "editor/build",
    undefined,
    false,
    false
);
fs.rmSync(editorEntry);

// cleanup
scssFiles.forEach((scssFile) => {
    const cssFile = scssFile.slice(0, -4) + "css";
    if (fs.existsSync(cssFile)) fs.rmSync(cssFile);
});

if(buildErrors)
    throw buildErrors;

fs.cpSync("editor/index.html", "editor/build/index.html");
fs.cpSync("editor/assets", "editor/build/assets", {
    recursive: true
});

const sampleDemoDir = "editor-sample-demo";
if (fs.existsSync(sampleDemoDir)) {
    const zipData = await zip(
        sampleDemoDir, 
        async (file) => new Uint8Array(await fs.promises.readFile(file)), 
        (path) => fs.promises.readdir(path, { withFileTypes: true }),
        (file) => file.startsWith(".git"))
    await fs.promises.writeFile("Demo.zip", zipData);
}
