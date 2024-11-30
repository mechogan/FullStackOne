import fs from "fs";
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
// const outBaseFileJs = `${outDirEditor}/base.js`;
const outTsLib = `${outDirEditor}/tsLib`;

if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
}

// esbuild.buildSync({
//     entryPoints: ["src/index.ts"],
//     bundle: true,
//     format: "esm",
//     outfile: outBaseFileJs
// });

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

fs.cpSync("editor/index.html", `${outDirEditor}/index.html`);
fs.cpSync("editor/assets", `${outDirEditor}/assets`, {
    recursive: true
});

const styleEntrypoint = "editor/index.scss";
const { css } = await sass.compileAsync(styleEntrypoint, {
    style: production ? "compressed" : "expanded"
});
await fs.promises.writeFile(`${outDirEditor}/index.css`, css);

const scrollbarsStyle = "editor/style/globals/scrollbars.scss";
const scrollbarsCSS = await sass.compileAsync(scrollbarsStyle, {
    style: production ? "compressed" : "expanded"
});
await fs.promises.writeFile(
    `${outDirEditor}/scrollbars.css`,
    scrollbarsCSS.css
);

fs.cpSync("editor/icons", `${outDirEditor}/icons`, {
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

// child_process.execSync(
//     `tsc --declaration --skipLibCheck --module system --outfile ${outTsLib}/fullstacked.js src/fullstacked.ts`,
//     {
//         stdio: "inherit"
//     }
// );

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
