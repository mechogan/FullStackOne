import fs from "fs";
import path from "path";
import * as sass from "sass";
import { build } from "./platform/node/src/build";
import { scan } from "./editor/api/projects/scan";
import esbuild, { buildSync } from "esbuild";
import zip from "./editor/api/projects/zip";
import child_process from "child_process";

// TypeScript fix for JSC (Safari/WebKit) memory leak
// Refer to this for more info: https://github.com/microsoft/TypeScript/issues/58137
// Remove if ever fixed
const codeToLookup = "program = createProgram(options);";
const codeToAdd = "options.oldProgram = undefined;";
const tsFilePath = "node_modules/typescript/lib/typescript.js";
const tsFileContent = fs.readFileSync(tsFilePath, { encoding: "utf-8" });
const re = new RegExp(
    `${codeToLookup.replace(/(\(|\))/g, (c) => (c === "(" ? "\\(" : "\\)"))}(${codeToAdd})*`
);
const textBlockToUpdate = tsFileContent.match(re);
if (textBlockToUpdate) {
    if (!textBlockToUpdate[0].endsWith(codeToAdd)) {
        fs.writeFileSync(
            tsFilePath,
            tsFileContent.replace(re, codeToLookup + codeToAdd)
        );
    }
} else {
    throw "Could not find typescript code block to patch.";
}

const baseFile = "src/js/base.js";

esbuild.buildSync({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "esm",
    outfile: baseFile
});

if (fs.existsSync("editor/build"))
    fs.rmSync("editor/build", { recursive: true });

// old-styles
const scssFiles = (await scan("editor", fs.promises.readdir as any)).filter(
    (filePath) => filePath.endsWith(".scss")
);

const compileScss = async (scssFile: string) => {
    const { css } = await sass.compileAsync(scssFile);
    if (css.length) fs.writeFileSync(scssFile.slice(0, -4) + "css", css);
};
const compilePromises = scssFiles.map(compileScss);
await Promise.all(compilePromises);
// end old-styles

const toBuild = [
    ["editor/index.ts", "index"],
    ["editor/typescript/worker.ts", "worker-ts"]
];

const baseJS = await fs.promises.readFile(baseFile, { encoding: "utf-8" });
let buildErrors = [];
for (const [input, output] of toBuild) {
    const mergedContent = `${baseJS}\nimport("${path.resolve(input).split("\\").join("/")}");`;
    const tmpFile = `.cache/tmp-${Date.now()}.js`;
    await fs.promises.writeFile(tmpFile, mergedContent);
    const errors = build(
        esbuild.buildSync,
        tmpFile,
        output,
        "editor/build",
        undefined,
        "external",
        false
    );
    fs.rmSync(tmpFile);
    if (errors) buildErrors.push(errors);
}

// cleanup
scssFiles.forEach((scssFile) => {
    const cssFile = scssFile.slice(0, -4) + "css";
    if (fs.existsSync(cssFile)) fs.rmSync(cssFile);
});

if (buildErrors.length) throw buildErrors;

fs.cpSync("editor/index.html", "editor/build/index.html");
fs.cpSync("editor/assets", "editor/build/assets", {
    recursive: true
});

// new-ui
const styleEntrypoint = "editor/new-ui.scss";
const { css } = await sass.compileAsync(styleEntrypoint);
await fs.promises.writeFile("editor/build/new-ui.css", css);

buildSync({
    entryPoints: ["editor/new-ui.ts"],
    outfile: "editor/build/new-ui.js",
    bundle: true
});

await fs.promises.copyFile("editor/new-ui.html", "editor/build/new-ui.html");
fs.cpSync("editor/icons", "editor/build/icons", {
    recursive: true
});
// end new-ui

const sampleDemoDir = "editor-sample-demo";
if (fs.existsSync(sampleDemoDir)) {
    const zipData = await zip(
        sampleDemoDir,
        async (file) => new Uint8Array(await fs.promises.readFile(file)),
        (path) => fs.promises.readdir(path, { withFileTypes: true }),
        (file) => file.startsWith(".git")
    );
    await fs.promises.writeFile("editor/build/Demo.zip", zipData);
}

fs.cpSync("node_modules/typescript/lib", "editor/build/tsLib", {
    recursive: true
});

child_process.execSync(
    "tsc --declaration --skipLibCheck --module system --outfile editor/build/tsLib/fullstacked.js src/adapter/fullstacked.ts",
    {
        stdio: "inherit"
    }
);

const { version } = JSON.parse(
    fs.readFileSync("package.json", { encoding: "utf-8" })
);
const branch = child_process
    .execSync("git rev-parse --abbrev-ref HEAD")
    .toString()
    .trim();
const commit = child_process.execSync("git rev-parse HEAD").toString().trim();
fs.writeFileSync(
    "editor/build/version.json",
    JSON.stringify({
        version,
        branch,
        commit
    })
);
