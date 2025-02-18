import fs from "node:fs";
import * as sass from "sass";
import esbuild from "esbuild";
import child_process from "child_process";
import AdmZip from "adm-zip";

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

// END fix

const outDir = "out";
const outDirEditor = `${outDir}/editor`;
const outTsLib = `${outDirEditor}/tsLib`;

if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
}

async function processScss(entryPoint: string, out: string) {
    const { css } = await sass.compileAsync(entryPoint, {
        style: production ? "compressed" : "expanded"
    });
    await fs.promises.writeFile(out, css);
}

await processScss("editor/index.scss", `editor/index.css`);

const toBuild = [
    ["editor/index.ts", "index"],
    ["editor/typescript/worker.ts", "worker-ts"]
];

for (const [input, output] of toBuild) {
    esbuild.buildSync({
        entryPoints: [
            {
                in: input,
                out: output
            }
        ],
        bundle: true,
        format: "esm",
        outdir: outDirEditor,
        sourcemap: production ? false : "external",
        splitting: false,
        minify: production
    });
}

fs.rmSync("editor/index.css");

fs.cpSync("editor/index.html", `${outDirEditor}/index.html`);
fs.cpSync("editor/assets", `${outDirEditor}/assets`, {
    recursive: true
});

await processScss(
    "editor/style/scrollbars.scss",
    `${outDirEditor}/scrollbars.css`
);

fs.cpSync("node_modules/@fullstacked/ui/icons", `${outDirEditor}/icons`, {
    recursive: true
});

const sampleDemoDir = "editor-sample-demo";
if (fs.existsSync(sampleDemoDir)) {
    const zip = new AdmZip();
    zip.addLocalFolder(sampleDemoDir, "", (file) => !file.startsWith(".git"));
    zip.writeZip(`${outDirEditor}/Demo.zip`);
}

fs.cpSync("node_modules/typescript/lib", outTsLib, {
    recursive: true
});

fs.cpSync("lib/fullstacked.d.ts", outTsLib + "/fullstacked.d.ts", {
    recursive: true
});
fs.cpSync("lib", outDirEditor + "/lib", {
    recursive: true,
    filter: (s) => !s.endsWith(".scss")
});
await processScss(
    "lib/components/snackbar.scss",
    `${outDirEditor}/lib/components/snackbar.css`
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
    .execSync(`git rev-list --count ${branch}`)
    .toString()
    .trim();
fs.writeFileSync(
    `${outDirEditor}/version.json`,
    JSON.stringify({
        version,
        branch,
        commit,
        commitNumber
    })
);

if (!process.argv.includes("--no-zip")) {
    const outZipDir = `${outDir}/zip`;
    const outZip = `${outZipDir}/editor-${production ? commitNumber : Date.now()}.zip`;
    const zip = new AdmZip();
    zip.addLocalFolder(outDirEditor);
    fs.mkdirSync(outZipDir, { recursive: true });
    zip.writeZip(outZip);
}
