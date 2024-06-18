import esbuild from "esbuild";
import fs from 'fs';
import child_process from "child_process";

if(fs.existsSync("package")){
    fs.rmSync("package", {recursive: true});
}

fs.mkdirSync("package")

fs.cpSync("../../editor/build", "package/editor", {recursive: true});
fs.cpSync("../../src/js", "package/js", {recursive: true});

esbuild.buildSync({
    entryPoints: ["src/index.ts"],
    outfile: "package/index.mjs",
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["esbuild"],
    banner: {
        js: 'import { createRequire } from "module";const require = createRequire(import.meta.url);'
    },
})

child_process.execSync("docker build -t fullstackedorg/editor .", { stdio: "inherit" });