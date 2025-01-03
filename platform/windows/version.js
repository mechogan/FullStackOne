import child_process from "child_process";
import fs from "node:fs";

const packageJsonFile = "../../package.json";
const packageJsonContent = fs.readFileSync(packageJsonFile, { encoding: "utf-8" });
const packageJson = JSON.parse(packageJsonContent);

const [major, minor, patch] = packageJson.version.split(".")

const branch = "main";
const buildNumber = child_process
    .execSync(`git rev-list --count ${branch}`)
    .toString()
    .trim();

const winVersion = `${major}.${minor}.${buildNumber}.0`

const packageFile = "Package.appxmanifest";
let packageContent = fs.readFileSync(packageFile, { encoding: "utf-8" });
packageContent = packageContent.replace(/\bVersion="\d+\.\d+\.\d+\.\d+"/g, `Version="${winVersion}"`)
fs.writeFileSync(packageFile, packageContent);