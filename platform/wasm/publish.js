import path from "node:path";
import url from "node:url";
import child_process from "node:child_process";

const currentDirectory = path.dirname(url.fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(currentDirectory, "..", "..");

// build editor

child_process.execSync("npm run build -- --production", {
    cwd: rootDirectory,
    stdio: "inherit"
});

// build core

child_process.execSync("make wasm", {
    cwd: path.resolve(rootDirectory, "core", "build"),
    stdio: "inherit"
});

// build

child_process.execSync("npm run build", {
    cwd: currentDirectory,
    stdio: "inherit"
});

// upload to CF Pages

child_process.execSync("npx wrangler pages deploy out", {
    cwd: currentDirectory,
    stdio: "inherit"
});