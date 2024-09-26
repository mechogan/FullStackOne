import fs from "fs";
import child_process from "child_process";
import semver from "semver";

async function getLatestReleaseVersion() {
    const response = await fetch("https://api.github.com/repos/fullstackedorg/editor/releases/latest");
    const { tag_name } = await response.json();
    return tag_name;
}

async function getLatestCommit() {
    const response = await fetch("https://api.github.com/repos/fullstackedorg/editor/git/refs/heads/main");
    const { object: { sha } } = await response.json();
    return sha;
}

function pullAndExit() {
    child_process.execSync("git pull", { stdio: "inherit" });
    child_process.execSync("git submodule update --init --recursive", { stdio: "inherit" });
    process.exit(0);
}

function notifyError(message) {
    console.log(message);
    process.exit(1);
}



const currentVersion = JSON.parse(fs.readFileSync("package.json", { encoding: "utf-8" })).version;
const latestReleaseVersion = await getLatestReleaseVersion();

if (semver.lte(currentVersion, latestReleaseVersion)) {
    notifyError(`Trying to run same or older version. Current [${currentVersion}] | Latest [${latestReleaseVersion}]`);
}

try {
    child_process.execSync("npm ci", { stdio: "inherit" });
} catch (e) {
    console.error(e);
    notifyError("Failed to run [npm ci]");
}

try {
    child_process.execSync("npm run build", { stdio: "inherit" });
} catch (e) {
    console.error(e)
    notifyError("Failed to run [npm run build]");
}

try {
    child_process.execSync("npm test", { stdio: "inherit" });
} catch (e) {
    console.error(e)
    notifyError("Failed to run [npm test]");
}


// node
async function getLatestBeta() {
    const response = await fetch("https://registry.npmjs.org/@fullstacked/editor/beta");
    const { version } = await response.json();
    return version;
}

const latestBeta = await getLatestBeta();

const [latestBetaVersion, latestBetaBuild] = latestBeta.split("-")

const build = semver.eq(latestBetaVersion, currentVersion)
    ? parseInt(latestBetaBuild) + 1
    : 0;

const nodeDirectory = "platform/node";
const nodePackageJsonFile = `${nodeDirectory}/package.json`;    
const nodePackageJson = JSON.parse(fs.readFileSync(nodePackageJsonFile, { encoding: "utf-8" }));
nodePackageJson.version = currentVersion + "-" + build;
fs.writeFileSync(nodePackageJsonFile, JSON.stringify(nodePackageJson, null, 4));

try {
    child_process.execSync("npm publish --tag beta", {
        cwd: nodeDirectory,
        stdio: "inherit"
    })
} catch(e) {
    console.error(e);
    notifyError("Failed to publish node to npmjs");
}


// electron


// ios

// android

// docker

