import path from "node:path";
import url from "node:url";
import fs from "node:fs";
import child_process from "node:child_process";
import version from "../../version.js";
import pty from "node-pty";

const currentDirectory = path.dirname(url.fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(currentDirectory, "..", "..");

const isRelease = process.argv.includes("--release");

// build editor

child_process.execSync("npm run build -- -- --production", {
    cwd: rootDirectory,
    stdio: "inherit"
});

// build core

child_process.execSync("cmd.exe /c windows.bat", {
    cwd: path.resolve(rootDirectory, "core", "build"),
    stdio: "inherit"
});

// update version

const versionStr = `${version.major}.${version.minor}.${version.build}.0`
const packageFile = path.resolve(currentDirectory, "Package.appxmanifest");
let packageContent = fs.readFileSync(packageFile, { encoding: "utf-8" });
packageContent = packageContent.replace(/\bVersion="\d+\.\d+\.\d+\.\d+"/g, `Version="${versionStr}"`)
fs.writeFileSync(packageFile, packageContent);

// clean

const appPackages = path.resolve(currentDirectory, "AppPackages");
if(fs.existsSync(appPackages))
    fs.rmSync(appPackages, { recursive: true })

// msstore

const ptyProcess = pty.spawn("cmd.exe", [], {
    name: 'msstore-process',
    cols: 80,
    rows: 30,
    cwd: currentDirectory,
    env: process.env
});

let stdout = "";
let selectionDone = false;
await new Promise(res => {
    ptyProcess.onData((data) => {
        stdout += data.trim();

        if (!selectionDone && stdout.includes("FullStacked (Beta)")) {
            if (!isRelease && !stdout.includes("> FullStacked (Beta)")) {
                ptyProcess.write("\u001b[B");
                return;
            }

            selectionDone = true;
            ptyProcess.write("\r");
        }

        if (selectionDone && stdout.includes("configured to build to the Microsoft Store")) {
            ptyProcess.kill()
        }
    });
    ptyProcess.onExit(res);

    ptyProcess.write('msstore init\r');
});

packageContent = fs.readFileSync(packageFile, { encoding: "utf-8" });
if(isRelease && !packageContent.match(/<DisplayName>FullStacked<\/DisplayName>/)) {
    throw "Failed to init to FullStacked App"
} 
if(!isRelease && !packageContent.match(/<DisplayName>FullStacked \(Beta\)<\/DisplayName>/)) {
    throw "Failed to init to FullStacked (Beta) App"
}

child_process.execSync("msstore package", {
    cwd: currentDirectory,
    stdio: "inherit"
});

child_process.execSync("msstore publish", {
    cwd: currentDirectory,
    stdio: "inherit"
});
