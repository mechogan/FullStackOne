import path from "node:path";
import url from "node:url";
import fs from "node:fs";
import child_process from "node:child_process";
import version from "../../version.js";

const isRelease = process.argv.includes("--release");

const currentDirectory = path.dirname(url.fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(currentDirectory, "..", "..");

// build editor

child_process.execSync("npm run build -- --production", {
    cwd: rootDirectory,
    stdio: "inherit"
});

fs.cpSync(path.resolve(rootDirectory, "out", "editor", "lib"), path.resolve(currentDirectory, "editor", "lib"), { recursive: true });

// update version

const packageJsonFilePath = path.resolve(currentDirectory, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonFilePath, { encoding: "utf-8" }));
packageJson.version = isRelease
    ? `${version.major}.${version.minor}.${version.patch}`
    : `${version.major}.${version.minor}.${version.patch}-${version.build}`;

fs.writeFileSync(packageJsonFilePath, JSON.stringify(packageJson, null, 4));
