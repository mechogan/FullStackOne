import fs from "fs";
import path from "path";
import * as sass from "sass";
import { build } from "./platform/node/src/build";
import esbuild from "esbuild";
import zip from "./editor/api/projects/zip";
import child_process from "child_process";

const production = process.argv.includes("--production");

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

const toBuild = [
    ["editor/index.ts", "index"],
    ["editor/typescript/worker.ts", "worker-ts"],
    ["editor/views/packages/worker.ts", "worker-package-install"]
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
        production ? false : "external",
        false,
        production
    );
    fs.rmSync(tmpFile);
    if (errors) buildErrors.push(errors);
}

if (buildErrors.length) throw buildErrors;

fs.cpSync("editor/index.html", "editor/build/index.html");
fs.cpSync("editor/assets", "editor/build/assets", {
    recursive: true
});

const styleEntrypoint = "editor/index.scss";
const { css } = await sass.compileAsync(styleEntrypoint, {
    style: production ? "compressed" : "expanded"
});
await fs.promises.writeFile("editor/build/index.css", css);

const scrollbarsStyle = "editor/style/globals/scrollbars.scss";
const scrollbarsCSS = await sass.compileAsync(scrollbarsStyle, {
    style: production ? "compressed" : "expanded"
});
await fs.promises.writeFile("editor/build/scrollbars.css", scrollbarsCSS.css);

fs.cpSync("editor/icons", "editor/build/icons", {
    recursive: true
});

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
const commitNumber = child_process
    .execSync("git rev-list --count --all")
    .toString()
    .trim();
fs.writeFileSync(
    "editor/build/version.json",
    JSON.stringify({
        version,
        branch,
        commit,
        commitNumber
    })
);
