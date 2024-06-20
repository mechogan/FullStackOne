import esbuild from "esbuild";
import fs from "fs";
import child_process from "child_process";

if (fs.existsSync("package")) {
    fs.rmSync("package", { recursive: true });
}

fs.mkdirSync("package");

fs.cpSync("../../editor/build", "package/editor", { recursive: true });
fs.cpSync("../../src/js", "package/js", { recursive: true });

esbuild.buildSync({
    entryPoints: ["src/index.ts"],
    outfile: "package/index.mjs",
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["esbuild", "puppeteer-stream"],
    banner: {
        js: 'import { createRequire } from "module";const require = createRequire(import.meta.url);'
    }
});

esbuild.buildSync({
    entryPoints: ["src/remote/client/index.ts"],
    outfile: "package/dist/index.js",
    bundle: true,
    platform: "browser",
    format: "esm"
});

fs.cpSync("src/remote/client/index.html", "package/dist/index.html");

// child_process.execSync("docker build -t fullstackedorg/editor .", {
//     stdio: "inherit"
// });
