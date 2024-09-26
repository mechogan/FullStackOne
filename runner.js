import fs from "fs";
import child_process from "child_process";
import semver from "semver";
import * as zip from "@zip.js/zip.js";
import dotenv from "dotenv";

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

const electronDirectory = "platform/electron";
try {
    child_process.execSync("npm ci", {
        cwd: electronDirectory,
        stdio: "inherit"
    });
} catch (e) {
    console.error(e);
    notifyError("Failed to run [npm ci] in electron directory");
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


/////////// node /////////////

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
} catch (e) {
    console.error(e);
    notifyError("Failed to publish node to npmjs");
}


////////////// electron ////////////////

const electronOutDirectory = `${electronDirectory}/out`;
if (fs.existsSync(electronOutDirectory)) fs.rmSync(electronOutDirectory, { recursive: true, force: true });

const electronPackageJsonFile = `${electronDirectory}/package.json`;
const electronPackageJson = JSON.parse(fs.readFileSync(electronPackageJsonFile, { encoding: "utf-8" }))
electronPackageJson.version = currentVersion;
fs.writeFileSync(electronPackageJsonFile, JSON.stringify(electronPackageJson, null, 4));

const releaseFileNames = [
    `fullstacked-${currentVersion}-darwin-arm64.zip`,
    `fullstacked-${currentVersion}-darwin-x64.zip`,
    `fullstacked-${currentVersion}-win32-arm64.zip`,
    `fullstacked-${currentVersion}-win32-x64.zip`,
    `fullstacked-${currentVersion}-linux-arm64.deb`,
    `fullstacked-${currentVersion}-linux-x64.deb`,
    `fullstacked-${currentVersion}-linux-arm64.rpm`,
    `fullstacked-${currentVersion}-linux-x64.rpm`,
]

child_process.execSync("npm run make -- --platform darwin", {
    cwd: electronDirectory,
    stdio: "inherit"
});

child_process.execSync(`wrangler r2 object put fullstacked/releases/${currentVersion}/${releaseFileNames.at(0)} --file=${electronOutDirectory}/make/zip/darwin/arm64/FullStacked-darwin-arm64-${currentVersion}.zip`, {
    stdio: "inherit"
});
child_process.execSync(`wrangler r2 object put fullstacked/releases/${currentVersion}/${releaseFileNames.at(1)} --file=${electronOutDirectory}/make/zip/darwin/x64/FullStacked-darwin-x64-${currentVersion}.zip`, {
    stdio: "inherit"
});


child_process.execSync("npm run make -- --platform win32", {
    cwd: electronDirectory,
    stdio: "inherit"
});

async function zipExe(directory, filename) {
    const zipFileStream = new TransformStream();
    const zipFileBlobPromise = new Response(zipFileStream.readable).blob();

    const data = fs.readFileSync(`${directory}/${filename}`);
    const readableStream = new Blob([data]).stream();

    const zipWriter = new zip.ZipWriter(zipFileStream.writable);
    await zipWriter.add(filename, readableStream);
    await zipWriter.close();

    const zipBlob = await zipFileBlobPromise
    const zipFileName = filename.split(".").slice(0, -1).join(".") + ".zip";
    fs.writeFileSync(`${directory}/${zipFileName}`, Buffer.from(await zipBlob.arrayBuffer()))
}

await Promise.all([
    zipExe(`${electronDirectory}/out/make/squirrel.windows/arm64`, `FullStacked-${currentVersion} Setup.exe`),
    zipExe(`${electronDirectory}/out/make/squirrel.windows/x64`, `FullStacked-${currentVersion} Setup.exe`)
])

child_process.execSync(`wrangler r2 object put fullstacked/releases/${currentVersion}/${releaseFileNames.at(2)} --file="${electronOutDirectory}/make/squirrel.windows/arm64/FullStacked-${currentVersion} Setup.zip"`, {
    stdio: "inherit"
});
child_process.execSync(`wrangler r2 object put fullstacked/releases/${currentVersion}/${releaseFileNames.at(3)} --file="${electronOutDirectory}/make/squirrel.windows/x64/FullStacked-${currentVersion} Setup.zip"`, {
    stdio: "inherit"
});


child_process.execSync("npm run make -- --platform linux", {
    cwd: electronDirectory,
    stdio: "inherit"
});

child_process.execSync(`wrangler r2 object put fullstacked/releases/${currentVersion}/${releaseFileNames.at(4)} --file=${electronOutDirectory}/make/deb/arm64/fullstacked_${currentVersion}_arm64.deb`, {
    stdio: "inherit"
});
child_process.execSync(`wrangler r2 object put fullstacked/releases/${currentVersion}/${releaseFileNames.at(5)} --file=${electronOutDirectory}/make/deb/x64/fullstacked_${currentVersion}_amd64.deb`, {
    stdio: "inherit"
});
child_process.execSync(`wrangler r2 object put fullstacked/releases/${currentVersion}/${releaseFileNames.at(6)} --file=${electronOutDirectory}/make/rpm/arm64/FullStacked-${currentVersion}-1.arm64.rpm`, {
    stdio: "inherit"
});
child_process.execSync(`wrangler r2 object put fullstacked/releases/${currentVersion}/${releaseFileNames.at(7)} --file=${electronOutDirectory}/make/rpm/x64/FullStacked-${currentVersion}-1.x86_64.rpm`, {
    stdio: "inherit"
});


/////////////// ios /////////////////

const iosDirectory = "platform/ios";

child_process.execSync("make ios", {
    cwd: `${iosDirectory}/esbuild`,
    stdio: "inherit"
});

const commitNumber = child_process.execSync("git rev-list --count --all").toString().trim();

const xcodeFile = `${iosDirectory}/xcode/FullStacked.xcodeproj/project.pbxproj`;
const xcodeFileContent = fs.readFileSync(xcodeFile, { encoding: "utf-8" });
const xcodeFileUpdated = xcodeFileContent
    .replace(
        /MARKETING_VERSION = .*?;/g,
        `MARKETING_VERSION = ${currentVersion};`
    )
    .replace(
        /CURRENT_PROJECT_VERSION = .*?;/g,
        `CURRENT_PROJECT_VERSION = ${commitNumber};`
    );
fs.writeFileSync(xcodeFile, xcodeFileUpdated);

const xcodeDirectory = `${process.cwd()}/${iosDirectory}/xcode`;
const archivePath = `${process.cwd()}/${iosDirectory}/FullStacked.xcarchive`;
const pkgDirectory = `${process.cwd()}/${iosDirectory}/pkg`;

if (fs.existsSync(archivePath)) fs.rmSync(archivePath, { recursive: true, force: true });
if (fs.existsSync(pkgDirectory)) fs.rmSync(pkgDirectory, { recursive: true, force: true });

const appleKeys = dotenv.parse(fs.readFileSync(`${iosDirectory}/APPLE_KEYS.env`));

child_process.execSync(`xcodebuild -project ${xcodeDirectory}/FullStacked.xcodeproj -scheme FullStacked -sdk iphoneos -configuration Release clean`, {
    stdio: "inherit"
});
child_process.execSync(`xcodebuild -project ${xcodeDirectory}/FullStacked.xcodeproj -scheme FullStacked -sdk iphoneos -configuration Release archive -archivePath ${archivePath}`, {
    stdio: "inherit"
});
child_process.execSync(`xcodebuild -exportArchive -archivePath ${archivePath} -exportOptionsPlist ${process.cwd()}/${iosDirectory}/exportOptions.plist -exportPath ${pkgDirectory} -allowProvisioningUpdates`, {
    stdio: "inherit"
});
child_process.execSync(`xcrun altool --upload-app --file ${pkgDirectory}/FullStacked.ipa -t ios --apiKey ${appleKeys.APPLE_API_KEY_ID} --apiIssuer ${appleKeys.APPLE_API_ISSUER} --show-progress`, {
    stdio: "inherit",
    env: {
        API_PRIVATE_KEYS_DIR: appleKeys.APPLE_API_KEY_DIRECTORY
    }
})

///////////// android //////////////





///////////// docker ///////////////


