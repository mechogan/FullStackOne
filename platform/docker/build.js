import esbuild from "esbuild";
import fs from "fs";
import child_process from "child_process";

if (fs.existsSync("package")) {
    fs.rmSync("package", { recursive: true });
}

fs.mkdirSync("package");

fs.cpSync("../../editor/build", "package/editor", { recursive: true });
fs.cpSync("../../src/js", "package/js", { recursive: true });

child_process.execSync(
    "npm run build && npm pack --pack-destination ../../platform/docker/package",
    {
        stdio: "inherit",
        cwd: "../../lib/puppeteer-stream"
    }
);
const puppeteerStreamTgz = fs
    .readdirSync("package")
    .find((file) => file.endsWith(".tgz"));
fs.renameSync(`package/${puppeteerStreamTgz}`, `package/puppeteer-stream.tgz`);

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

if (process.argv.includes("--image")) {
    child_process.execSync("docker build -t fullstackedorg/editor .", {
        stdio: "inherit"
    });
} else {
    child_process.execSync(`npm i --no-save ./package/puppeteer-stream.tgz`, {
        stdio: "inherit"
    });
}
