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

function notifyError(message, exit = true) {
    console.log(message);
    if(exit)
        process.exit(1);
}

const currentVersion = JSON.parse(fs.readFileSync("package.json", { encoding: "utf-8" })).version;
const latestReleaseVersion = await getLatestReleaseVersion();

if (semver.lte(currentVersion, latestReleaseVersion)) {
    notifyError(`Trying to run same or older version. Current [${currentVersion}] | Latest [${latestReleaseVersion}]`);
}

const commitNumber = child_process.execSync("git rev-list --count --all").toString().trim();


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

const nodeDirectory = "platform/node";

async function getLatestBeta() {
    const response = await fetch("https://registry.npmjs.org/@fullstacked/editor/beta");
    const { version } = await response.json();
    return version;
}

const NODE_BUILD = async () => {
    const latestBeta = await getLatestBeta();

    const [latestBetaVersion, latestBetaBuild] = latestBeta.split("-")

    const build = semver.eq(latestBetaVersion, currentVersion)
        ? parseInt(latestBetaBuild) + 1
        : 0;

    const nodePackageJsonFile = `${nodeDirectory}/package.json`;
    const nodePackageJson = JSON.parse(fs.readFileSync(nodePackageJsonFile, { encoding: "utf-8" }));
    nodePackageJson.version = currentVersion + "-" + build;
    fs.writeFileSync(nodePackageJsonFile, JSON.stringify(nodePackageJson, null, 4));

    child_process.execSync("npm run build", {
        cwd: nodeDirectory,
        stdio: "inherit"
    })
}

const NODE_DEPLOY = () => {
    child_process.execSync("npm publish --tag beta", {
        cwd: nodeDirectory,
        stdio: "inherit"
    })
}


////////////// electron ////////////////

const electronOutDirectory = `${electronDirectory}/out`;

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

const ELECTRON_BUILD = () => {
    if (fs.existsSync(electronOutDirectory)) fs.rmSync(electronOutDirectory, { recursive: true, force: true });

    const electronPackageJsonFile = `${electronDirectory}/package.json`;
    const electronPackageJson = JSON.parse(fs.readFileSync(electronPackageJsonFile, { encoding: "utf-8" }))
    electronPackageJson.version = currentVersion;
    fs.writeFileSync(electronPackageJsonFile, JSON.stringify(electronPackageJson, null, 4));

    child_process.execSync("npm run make -- --platform darwin", {
        cwd: electronDirectory,
        stdio: "inherit"
    });
    child_process.execSync("npm run make -- --platform win32", {
        cwd: electronDirectory,
        stdio: "inherit"
    });
    child_process.execSync("npm run make -- --platform linux", {
        cwd: electronDirectory,
        stdio: "inherit"
    });

    return Promise.all([
        zipExe(`${electronDirectory}/out/make/squirrel.windows/arm64`, `FullStacked-${currentVersion} Setup.exe`),
        zipExe(`${electronDirectory}/out/make/squirrel.windows/x64`, `FullStacked-${currentVersion} Setup.exe`)
    ])
}


const releaseFileNames = [
    {
        out: `zip/darwin/arm64/FullStacked-darwin-arm64-${currentVersion}.zip`,
        bin: `fullstacked-${currentVersion}-darwin-arm64.zip`
    },
    {
        out: `zip/darwin/x64/FullStacked-darwin-x64-${currentVersion}.zip`,
        bin: `fullstacked-${currentVersion}-darwin-x64.zip`
    },
    {
        out: `squirrel.windows/arm64/FullStacked-${currentVersion} Setup.zip`,
        bin: `fullstacked-${currentVersion}-win32-arm64.zip`
    },
    {
        out: `squirrel.windows/x64/FullStacked-${currentVersion} Setup.zip`,
        bin: `fullstacked-${currentVersion}-win32-x64.zip`
    },
    {
        out: `deb/arm64/fullstacked_${currentVersion}_arm64.deb`,
        bin: `fullstacked-${currentVersion}-linux-arm64.deb`
    },
    {
        out: `deb/x64/fullstacked_${currentVersion}_amd64.deb`,
        bin: `fullstacked-${currentVersion}-linux-x64.deb`
    },
    {
        out: `rpm/arm64/FullStacked-${currentVersion}-1.arm64.rpm`,
        bin: `fullstacked-${currentVersion}-linux-arm64.rpm`,
    },
    {
        out: `rpm/x64/FullStacked-${currentVersion}-1.x86_64.rpm`,
        bin: `fullstacked-${currentVersion}-linux-x64.rpm`,
    }
]

const electronMakeDirectory = `${electronOutDirectory}/make`;
const cloudflareKeys = dotenv.parse(fs.readFileSync(`${electronDirectory}/CLOUDFLARE.env`));

const ELECTRON_DEPLOY = () => {
    for (const { out, bin } of releaseFileNames) {
        child_process.execSync(`wrangler r2 object put fullstacked/releases/${currentVersion}/${bin} --file=${electronMakeDirectory}/${out}`, {
            stdio: "inherit",
            env: {
                CLOUDFLARE_ACCOUNT_ID: cloudflareKeys.CLOUDFLARE_ACCOUNT_ID
            }
        });
    }
}

/////////////// ios /////////////////

const iosDirectory = "platform/ios";
const xcodeDirectory = `${process.cwd()}/${iosDirectory}/xcode`;
const archivePath = `${process.cwd()}/${iosDirectory}/FullStacked.xcarchive`;
const pkgDirectory = `${process.cwd()}/${iosDirectory}/pkg`;
const appleKeys = dotenv.parse(fs.readFileSync(`${iosDirectory}/APPLE_KEYS.env`));

const IOS_BUILD = () => {
    child_process.execSync("make ios", {
        cwd: `${iosDirectory}/esbuild`,
        stdio: "inherit"
    });


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

    if (fs.existsSync(archivePath)) fs.rmSync(archivePath, { recursive: true, force: true });
    if (fs.existsSync(pkgDirectory)) fs.rmSync(pkgDirectory, { recursive: true, force: true });


    child_process.execSync(`xcodebuild -project ${xcodeDirectory}/FullStacked.xcodeproj -scheme FullStacked -sdk iphoneos -configuration Release clean`, {
        stdio: "inherit"
    });
    child_process.execSync(`xcodebuild -project ${xcodeDirectory}/FullStacked.xcodeproj -scheme FullStacked -sdk iphoneos -configuration Release archive -archivePath ${archivePath}`, {
        stdio: "inherit"
    });
    child_process.execSync(`xcodebuild -exportArchive -archivePath ${archivePath} -exportOptionsPlist ${process.cwd()}/${iosDirectory}/exportOptions.plist -exportPath ${pkgDirectory} -allowProvisioningUpdates`, {
        stdio: "inherit"
    });
}


const IOS_DEPLOY = () => {
    child_process.execSync(`xcrun altool --upload-app --file ${pkgDirectory}/FullStacked.ipa -t ios --apiKey ${appleKeys.APPLE_API_KEY_ID} --apiIssuer ${appleKeys.APPLE_API_ISSUER} --show-progress`, {
        stdio: "inherit",
        env: {
            API_PRIVATE_KEYS_DIR: appleKeys.APPLE_API_KEY_DIRECTORY
        }
    })
}


///////////// android //////////////

const androidDirectory = "platform/android";
const androidKeys = dotenv.parse(fs.readFileSync(`${androidDirectory}/ANDROID_KEYS.env`));
const aabFile = `${process.cwd()}/${androidDirectory}/studio/app/build/outputs/bundle/release/app-release.aab`;


const ANDROID_BUILD = () => {
    child_process.execSync("make android", {
        cwd: `${androidDirectory}/esbuild`,
        stdio: "inherit"
    });
    
    const gradleFile = `${androidDirectory}/studio/app/build.gradle.kts`;
    const gradleFileContent = fs.readFileSync(gradleFile, { encoding: "utf-8" });
    const gradleFileUpdated = gradleFileContent
        .replace(
            /versionName = ".*?"/g,
            `versionName = "${currentVersion}"`
        )
        .replace(
            /versionCode = .*?\n/g,
            `versionCode = ${commitNumber}\n`
        );
    fs.writeFileSync(gradleFile, gradleFileUpdated);
    
    child_process.execSync("./gradlew bundleRelease", {
        cwd: `${androidDirectory}/studio`,
        stdio: "inherit"
    });
    
    child_process.execSync(`jarsigner -keystore ${androidKeys.FILE} -storepass ${androidKeys.PASSPHRASE} ${aabFile} ${androidKeys.KEY}`, {
        cwd: `${androidDirectory}/studio`,
        stdio: "inherit"
    });
}

const ANDROID_DEPLOY = () => {
    child_process.execSync(`python upload.py org.fullstacked.editor ${aabFile} ${currentVersion}`, {
        stdio: "inherit",
        cwd: androidDirectory
    })
}


///////////// docker ///////////////

const dockerDirectory = "platform/docker";

const DOCKER_BUILD = () => {
    child_process.execSync(`npm ci`, {
        stdio: "inherit",
        cwd: "lib/puppeteer-stream"
    })
    
    child_process.execSync("node build --image beta", {
        stdio: "inherit",
        cwd: dockerDirectory
    })
}

const DOCKER_DEPLOY = () => {
    child_process.execSync("docker push fullstackedorg/editor:beta", {
        stdio: "inherit"
    })
}



///////// BUILD ////////


try {
    await NODE_BUILD();
} catch(e) {
    console.error(e);
    notifyError("Failed to build for node")
}
try {
    await ELECTRON_BUILD();
} catch(e) {
    console.error(e);
    notifyError("Failed to build for electron")
}
try {
    IOS_BUILD();
} catch(e) {
    console.error(e);
    notifyError("Failed to build for ios")
}
try {
    ANDROID_BUILD();
} catch(e) {
    console.error(e);
    notifyError("Failed to build for android")
}
try {
    DOCKER_BUILD();
} catch(e) {
    console.error(e);
    notifyError("Failed to build for docker")
}


///////// DEPLOY ////////


try {
    NODE_DEPLOY();
} catch(e) {
    console.error(e);
    notifyError("Failed to deploy for node", false)
}
try {
    ELECTRON_DEPLOY();
} catch(e) {
    console.error(e);
    notifyError("Failed to deplooy for electron", false)
}
try {
    IOS_DEPLOY();
} catch(e) {
    console.error(e);
    notifyError("Failed to deploy for ios", false)
}
try {
    ANDROID_DEPLOY();
} catch(e) {
    console.error(e);
    notifyError("Failed to deploy for android", false)
}
try {
    DOCKER_DEPLOY();
} catch(e) {
    console.error(e);
    notifyError("Failed to deploy for docker", false)
}


