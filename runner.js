// loop this runner with
// while true; do node runner.js; done

import fs from "fs";
import child_process from "child_process";
import semver from "semver";
import dotenv from "dotenv";
import prettyMs from "pretty-ms";

const branch = "main";
const commit = child_process.execSync("git rev-parse HEAD").toString().trim();
const commitNumber = child_process
    .execSync(`git rev-list --count ${branch}`)
    .toString()
    .trim();
const release = process.argv.includes("--release");

async function getLatestReleaseVersion() {
    const response = await fetch(
        "https://api.github.com/repos/fullstackedorg/editor/releases/latest"
    );
    const { tag_name } = await response.json();
    return tag_name;
}

async function getLatestCommit() {
    const response = await fetch(
        `https://api.github.com/repos/fullstackedorg/editor/git/refs/heads/${branch}`
    );
    const {
        object: { sha }
    } = await response.json();
    return sha;
}

function pullAndExit() {
    console.log(`Pulling and exiting [${new Date().toLocaleString()}]`);

    child_process.execSync("git checkout .", { stdio: "inherit" });
    child_process.execSync("git pull", { stdio: "inherit" });
    child_process.execSync("git submodule update --init --recursive", {
        stdio: "inherit"
    });

    process.exit(0);
}

async function waitForNextCommit() {
    console.log(`${new Date().toLocaleString()} - Current commit [${commit}]`);
    console.log("Waiting for next commit.");
    while (commit === (await getLatestCommit())) {
        await new Promise((res) => setTimeout(res, 1000 * 60 * 3)); // 3 min
    }

    pullAndExit();
}

function notifyError(message, halt = true) {
    console.log(`${new Date().toLocaleString()} - ${message}`);
    if (halt) {
        return waitForNextCommit();
    }
}

const currentVersion = JSON.parse(
    fs.readFileSync("package.json", { encoding: "utf-8" })
).version;
const latestReleaseVersion = await getLatestReleaseVersion();

const electronDirectory = "platform/electron";

const TEST_AND_BUILD = () => {
    child_process.execSync("npm ci", { stdio: "inherit" });
    // child_process.execSync("npm test", { stdio: "inherit" });
    child_process.execSync("make ios-arm64 android macos-static -j8", {
        cwd: "core/build",
        stdio: "inherit"
    });
    child_process.execSync("npm run build -- --production", {
        stdio: "inherit"
    });
};

/////////////// apple /////////////////

const appleDirectory = "platform/apple";

const archivePathiOS = `${process.cwd()}/${appleDirectory}/FullStacked-iOS.xcarchive`;
const pkgDirectoryiOS = `${process.cwd()}/${appleDirectory}/pkg-ios`;

const archivePathMacOS = `${process.cwd()}/${appleDirectory}/FullStacked-MacOS.xcarchive`;
const pkgDirectoryMacOS = `${process.cwd()}/${appleDirectory}/pkg-macos`;

const appleKeys = dotenv.parse(
    fs.readFileSync(`${appleDirectory}/APPLE_KEYS.env`)
);

const APPLE_BUILD = () => {
    const xcodeFile = `${appleDirectory}/FullStacked.xcodeproj/project.pbxproj`;
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

    [
        archivePathiOS,
        pkgDirectoryiOS,
        archivePathMacOS,
        pkgDirectoryMacOS
    ].forEach((d) => {
        if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
    });

    child_process.execSync(
        `xcodebuild -project ${appleDirectory}/FullStacked.xcodeproj -scheme FullStacked-iOS -sdk iphoneos -configuration Release clean`,
        {
            stdio: "inherit"
        }
    );
    child_process.execSync(
        `xcodebuild -project ${appleDirectory}/FullStacked.xcodeproj -scheme FullStacked-iOS -sdk iphoneos -configuration Release archive -archivePath ${archivePathiOS}`,
        {
            stdio: "inherit"
        }
    );
    child_process.execSync(
        `xcodebuild -exportArchive -archivePath ${archivePathiOS} -exportOptionsPlist ${process.cwd()}/${appleDirectory}/exportOptions.plist -exportPath ${pkgDirectoryiOS} -allowProvisioningUpdates`,
        {
            stdio: "inherit"
        }
    );

    child_process.execSync(
        `xcodebuild -project ${appleDirectory}/FullStacked.xcodeproj -scheme FullStacked-MacOS -sdk macosx -configuration Release clean`,
        {
            stdio: "inherit"
        }
    );
    child_process.execSync(
        `xcodebuild -project ${appleDirectory}/FullStacked.xcodeproj -scheme FullStacked-MacOS -sdk macosx -configuration Release archive -archivePath ${archivePathMacOS}`,
        {
            stdio: "inherit"
        }
    );
    child_process.execSync(
        `xcodebuild -exportArchive -archivePath ${archivePathMacOS} -exportOptionsPlist ${process.cwd()}/${appleDirectory}/exportOptions.plist -exportPath ${pkgDirectoryMacOS} -allowProvisioningUpdates`,
        {
            stdio: "inherit"
        }
    );
};

const APPLE_DEPLOY = () => {
    child_process.execSync(
        `xcrun altool --upload-app --file ${pkgDirectoryiOS}/FullStacked.ipa -t ios --apiKey ${appleKeys.APPLE_API_KEY_ID} --apiIssuer ${appleKeys.APPLE_API_ISSUER} --show-progress`,
        {
            stdio: "inherit",
            env: {
                API_PRIVATE_KEYS_DIR: appleKeys.APPLE_API_KEY_DIRECTORY
            }
        }
    );
    child_process.execSync(
        `xcrun altool --upload-app --file ${pkgDirectoryMacOS}/FullStacked.pkg -t macosx --apiKey ${appleKeys.APPLE_API_KEY_ID} --apiIssuer ${appleKeys.APPLE_API_ISSUER} --show-progress`,
        {
            stdio: "inherit",
            env: {
                API_PRIVATE_KEYS_DIR: appleKeys.APPLE_API_KEY_DIRECTORY
            }
        }
    );
};

///////////// android //////////////

const androidDirectory = "platform/android";
const androidKeys = dotenv.parse(
    fs.readFileSync(`${androidDirectory}/ANDROID_KEYS.env`)
);
const aabFile = `${process.cwd()}/${androidDirectory}/studio/app/build/outputs/bundle/release/app-release.aab`;

const ANDROID_BUILD = () => {
    const gradleFile = `${androidDirectory}/studio/app/build.gradle.kts`;
    const gradleFileContent = fs.readFileSync(gradleFile, {
        encoding: "utf-8"
    });
    const gradleFileUpdated = gradleFileContent
        .replace(/versionName = ".*?"/g, `versionName = "${currentVersion}"`)
        .replace(/versionCode = .*?\n/g, `versionCode = ${commitNumber}\n`);
    fs.writeFileSync(gradleFile, gradleFileUpdated);

    child_process.execSync("./gradlew bundleRelease", {
        cwd: `${androidDirectory}/studio`,
        stdio: "inherit"
    });

    child_process.execSync(
        `jarsigner -keystore ${androidKeys.FILE} -storepass ${androidKeys.PASSPHRASE} ${aabFile} ${androidKeys.KEY}`,
        {
            cwd: `${androidDirectory}/studio`,
            stdio: "inherit"
        }
    );
};

const ANDROID_DEPLOY = () => {
    child_process.execSync(
        `python upload.py org.fullstacked.editor ${aabFile} ${currentVersion}`,
        {
            stdio: "inherit",
            cwd: androidDirectory
        }
    );
};

async function run() {
    const start = new Date();

    if (!release && semver.lte(currentVersion, latestReleaseVersion)) {
        await notifyError(
            `Trying to run same or older version. Current [${currentVersion}] | Latest [${latestReleaseVersion}]`
        );
    }

    /////// BUILD AND TESTS ////////

    let tries = 5;
    while (tries) {
        try {
            TEST_AND_BUILD();
            break;
        } catch (e) {
            notifyError("Failed build and test", false);
        }

        tries--;
    }

    if (tries === 0) {
        await notifyError("Failed 5 times to run build and test.");
    }

    ///////// BUILD PLATFORMS ////////

    try {
        APPLE_BUILD();
    } catch (e) {
        console.error(e);
        await notifyError("Failed to build for ios");
    }
    try {
        ANDROID_BUILD();
    } catch (e) {
        console.error(e);
        await notifyError("Failed to build for android");
    }


    try {
        APPLE_DEPLOY();
    } catch (e) {
        console.error(e);
        notifyError("Failed to deploy for ios", false);
    }
    try {
        ANDROID_DEPLOY();
    } catch (e) {
        console.error(e);
        notifyError("Failed to deploy for android", false);
    }

    const end = new Date();

    console.log(
        `${release ? "Released" : "Prereleased"} ${currentVersion} (${commitNumber}) - ${commit.slice(0, 8)} (${branch})`
    );
    console.log("----------------");
    console.log(`Started at ${start.toLocaleString()}`);
    console.log(`Ended at ${end.toLocaleString()}`);
    console.log(`Took ${prettyMs(end.getTime() - start.getTime())}`);

    setTimeout(waitForNextCommit, 1000 * 60 * 5); // 5 min
}

run();
