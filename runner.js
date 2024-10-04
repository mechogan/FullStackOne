import fs from "fs";
import child_process from "child_process";
import semver from "semver";
import * as zip from "@zip.js/zip.js";
import dotenv from "dotenv";
import {
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand,
    S3Client
} from "@aws-sdk/client-s3";
import prettyMs from "pretty-ms";

const branch = "main";
const commit = child_process.execSync("git rev-parse HEAD").toString().trim();
const commitNumber = child_process
    .execSync("git rev-list --count --all")
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
    while (commit === (await getLatestCommit())) {
        await new Promise((res) => setTimeout(res, 1000 * 60 * 3)); // 3 min
    }

    pullAndExit();
}

async function notifyError(message, halt = true) {
    console.log(`${new Date().toLocaleString()} - ${message}`);
    if (halt) {
        await waitForNextCommit();
    }
}

const currentVersion = JSON.parse(
    fs.readFileSync("package.json", { encoding: "utf-8" })
).version;
const latestReleaseVersion = await getLatestReleaseVersion();

if (semver.lte(currentVersion, latestReleaseVersion)) {
    notifyError(
        `Trying to run same or older version. Current [${currentVersion}] | Latest [${latestReleaseVersion}]`
    );
}

const start = new Date();

const electronDirectory = "platform/electron";

const BUILD_AND_TEST = () => {
    child_process.execSync("npm ci", { stdio: "inherit" });
    child_process.execSync("npm ci", {
        cwd: electronDirectory,
        stdio: "inherit"
    });
    child_process.execSync("npm run build", { stdio: "inherit" });
    child_process.execSync("npm test", { stdio: "inherit" });
};

/////////// node /////////////

const nodeDirectory = "platform/node";

const NODE_BUILD = async () => {
    const nodePackageJsonFile = `${nodeDirectory}/package.json`;
    const nodePackageJson = JSON.parse(
        fs.readFileSync(nodePackageJsonFile, { encoding: "utf-8" })
    );
    nodePackageJson.version = currentVersion + "-" + commitNumber;
    fs.writeFileSync(
        nodePackageJsonFile,
        JSON.stringify(nodePackageJson, null, 4)
    );

    child_process.execSync("npm run build", {
        cwd: nodeDirectory,
        stdio: "inherit"
    });
};

const NODE_DEPLOY = () => {
    child_process.execSync(`npm publish${release ? "" : " --tag beta"}`, {
        cwd: nodeDirectory,
        stdio: "inherit"
    });
};

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

    const zipBlob = await zipFileBlobPromise;
    const zipFileName = filename.split(".").slice(0, -1).join(".") + ".zip";
    fs.writeFileSync(
        `${directory}/${zipFileName}`,
        Buffer.from(await zipBlob.arrayBuffer())
    );
}

const ELECTRON_MAKE = (platform) => {
    console.log(`Starting Electron Forge make for [${platform}]`);
    const makeProcess = child_process.exec(
        `npx electron-forge make --arch=x64,arm64 --platform=${platform}`,
        {
            cwd: electronDirectory
        }
    );
    return new Promise((resolve, reject) => {
        let errored = false;
        makeProcess.stdout.on("data", (chunk) =>
            process.stdout.write(`[${platform}]: ${chunk.toString()}`)
        );
        makeProcess.stderr.on("data", (chunk) =>
            process.stderr.write(`[${platform}]: ${chunk.toString()}`)
        );
        makeProcess.on("error", (error) => {
            console.log(`Failed Electron Forge make for [${platform}]`);
            errored = true;
            reject(error);
        });
        makeProcess.on("exit", () => {
            if (errored) return;
            console.log(`Finished Electron Forge make for [${platform}]`);
            resolve();
        });
    });
};

const ELECTRON_BUILD = async () => {
    if (fs.existsSync(electronOutDirectory))
        fs.rmSync(electronOutDirectory, { recursive: true, force: true });

    const electronPackageJsonFile = `${electronDirectory}/package.json`;
    const electronPackageJson = JSON.parse(
        fs.readFileSync(electronPackageJsonFile, { encoding: "utf-8" })
    );
    electronPackageJson.version = currentVersion;
    fs.writeFileSync(
        electronPackageJsonFile,
        JSON.stringify(electronPackageJson, null, 4)
    );

    child_process.execSync("npm run build", {
        cwd: electronDirectory,
        stdio: "inherit"
    });

    await Promise.all(["darwin", "win32", "linux"].map(ELECTRON_MAKE));

    return Promise.all([
        zipExe(
            `${electronDirectory}/out/make/squirrel.windows/arm64`,
            `FullStacked-${currentVersion} Setup.exe`
        ),
        zipExe(
            `${electronDirectory}/out/make/squirrel.windows/x64`,
            `FullStacked-${currentVersion} Setup.exe`
        )
    ]);
};

const releaseFileNames = [
    {
        file: `zip/darwin/arm64/FullStacked-darwin-arm64-${currentVersion}.zip`,
        key: `fullstacked-${currentVersion}-darwin-arm64.zip`
    },
    {
        file: `zip/darwin/x64/FullStacked-darwin-x64-${currentVersion}.zip`,
        key: `fullstacked-${currentVersion}-darwin-x64.zip`
    },
    {
        file: `squirrel.windows/arm64/FullStacked-${currentVersion} Setup.zip`,
        key: `fullstacked-${currentVersion}-win32-arm64.zip`
    },
    {
        file: `squirrel.windows/x64/FullStacked-${currentVersion} Setup.zip`,
        key: `fullstacked-${currentVersion}-win32-x64.zip`
    },
    {
        file: `deb/arm64/fullstacked_${currentVersion}_arm64.deb`,
        key: `fullstacked-${currentVersion}-linux-arm64.deb`
    },
    {
        file: `deb/x64/fullstacked_${currentVersion}_amd64.deb`,
        key: `fullstacked-${currentVersion}-linux-x64.deb`
    },
    {
        file: `rpm/arm64/FullStacked-${currentVersion}-1.arm64.rpm`,
        key: `fullstacked-${currentVersion}-linux-arm64.rpm`
    },
    {
        file: `rpm/x64/FullStacked-${currentVersion}-1.x86_64.rpm`,
        key: `fullstacked-${currentVersion}-linux-x64.rpm`
    }
];

const electronMakeDirectory = `${electronOutDirectory}/make`;
const cloudflareKeys = dotenv.parse(
    fs.readFileSync(`${electronDirectory}/CLOUDFLARE.env`)
);

const Bucket = cloudflareKeys.BUCKET;

const tenMB = 10 * 1024 * 1024;

const UPLOAD = async ({ file, key }) => {
    const s3Client = new S3Client({
        region: "auto",
        endpoint: `https://${cloudflareKeys.ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: cloudflareKeys.ACCESS_KEY_ID,
            secretAccessKey: cloudflareKeys.SECRET_ACCESS_KEY
        },
        maxAttempts: 10,
        retryMode: "standard"
    });

    const Key = `releases/${currentVersion}/${key}`;
    const filePath = `${electronMakeDirectory}/${file}`;

    console.log(`Uploading [${filePath}] to Bucket: [${Bucket}] Key: [${Key}]`);

    const buffer = fs.readFileSync(filePath);

    let UploadId;

    try {
        const multipartUpload = await s3Client.send(
            new CreateMultipartUploadCommand({ Bucket, Key })
        );

        UploadId = multipartUpload.UploadId;

        const partsCount = Math.ceil(buffer.byteLength / tenMB);

        const uploadResults = [];
        for (let i = 0; i < partsCount; i++) {
            const start = i * tenMB;
            const end = start + tenMB;
            uploadResults.push(
                await s3Client
                    .send(
                        new UploadPartCommand({
                            Bucket,
                            Key,
                            UploadId,
                            Body: buffer.subarray(start, end),
                            PartNumber: i + 1
                        })
                    )
                    .then((d) => {
                        console.log(
                            `Uploaded ${uploadResults.length + 1}/${partsCount} for [${key}]`
                        );
                        return d;
                    })
            );
        }

        await s3Client.send(
            new CompleteMultipartUploadCommand({
                Bucket,
                Key,
                UploadId,
                MultipartUpload: {
                    Parts: uploadResults.map(({ ETag }, i) => ({
                        ETag,
                        PartNumber: i + 1
                    }))
                }
            })
        );

        console.log(`Uploaded [${Key}]`);
    } catch (err) {
        if (UploadId) {
            const abortCommand = new AbortMultipartUploadCommand({
                Bucket,
                Key,
                UploadId
            });

            await s3Client.send(abortCommand);
        }

        throw err;
    }
};

const tryUploadingUntilSuccess = async (item) => {
    let tries = 0,
        success = false;
    while (!success) {
        tries++;
        try {
            console.log(`Trying to upload [${item.key}] try ${tries}.`);
            await UPLOAD(item);
            success = true;
        } catch (e) {
            console.error(e);
        }
    }

    console.log(`Managed to upload [${item.key}] after ${tries} try.`);
};

const ELECTRON_DEPLOY = async () => {
    return Promise.all(releaseFileNames.map(tryUploadingUntilSuccess));
};

/////////////// ios /////////////////

const iosDirectory = "platform/ios";
const xcodeDirectory = `${process.cwd()}/${iosDirectory}/xcode`;
const archivePath = `${process.cwd()}/${iosDirectory}/FullStacked.xcarchive`;
const pkgDirectory = `${process.cwd()}/${iosDirectory}/pkg`;
const appleKeys = dotenv.parse(
    fs.readFileSync(`${iosDirectory}/APPLE_KEYS.env`)
);

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

    if (fs.existsSync(archivePath))
        fs.rmSync(archivePath, { recursive: true, force: true });
    if (fs.existsSync(pkgDirectory))
        fs.rmSync(pkgDirectory, { recursive: true, force: true });

    child_process.execSync(
        `xcodebuild -project ${xcodeDirectory}/FullStacked.xcodeproj -scheme FullStacked -sdk iphoneos -configuration Release clean`,
        {
            stdio: "inherit"
        }
    );
    child_process.execSync(
        `xcodebuild -project ${xcodeDirectory}/FullStacked.xcodeproj -scheme FullStacked -sdk iphoneos -configuration Release archive -archivePath ${archivePath}`,
        {
            stdio: "inherit"
        }
    );
    child_process.execSync(
        `xcodebuild -exportArchive -archivePath ${archivePath} -exportOptionsPlist ${process.cwd()}/${iosDirectory}/exportOptions.plist -exportPath ${pkgDirectory} -allowProvisioningUpdates`,
        {
            stdio: "inherit"
        }
    );
};

const IOS_DEPLOY = () => {
    child_process.execSync(
        `xcrun altool --upload-app --file ${pkgDirectory}/FullStacked.ipa -t ios --apiKey ${appleKeys.APPLE_API_KEY_ID} --apiIssuer ${appleKeys.APPLE_API_ISSUER} --show-progress`,
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
    child_process.execSync("make android", {
        cwd: `${androidDirectory}/esbuild`,
        stdio: "inherit"
    });

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

///////////// docker ///////////////

const dockerDirectory = "platform/docker";

const DOCKER_BUILD = () => {
    child_process.execSync(`npm ci`, {
        stdio: "inherit",
        cwd: "lib/puppeteer-stream"
    });

    child_process.execSync(
        `node build --image ${release ? "latest" : "beta"}`,
        {
            stdio: "inherit",
            cwd: dockerDirectory
        }
    );
};

const DOCKER_DEPLOY = () => {
    child_process.execSync(
        `docker push fullstackedorg/editor:${release ? "latest" : "beta"}`,
        {
            stdio: "inherit"
        }
    );
};

/////// BUILD AND TESTS ////////

let tries = 5;
while (tries) {
    try {
        BUILD_AND_TEST();
        break;
    } catch (e) {
        notifyError("Failed build and test", false);
    }

    tries--;
}

if (tries === 0) {
    notifyError(
        "Failed 5 times to run build and test."
    );
}

///////// BUILD PLATFORMS ////////

try {
    await NODE_BUILD();
} catch (e) {
    console.error(e);
    notifyError("Failed to build for node");
}
try {
    await ELECTRON_BUILD();
} catch (e) {
    console.error(e);
    notifyError("Failed to build for electron");
}
try {
    IOS_BUILD();
} catch (e) {
    console.error(e);
    notifyError("Failed to build for ios");
}
try {
    ANDROID_BUILD();
} catch (e) {
    console.error(e);
    notifyError("Failed to build for android");
}
try {
    DOCKER_BUILD();
} catch (e) {
    console.error(e);
    notifyError("Failed to build for docker");
}

///////// DEPLOY PLATFORMS ////////

try {
    NODE_DEPLOY();
} catch (e) {
    console.error(e);
    notifyError("Failed to deploy for node", false);
}
try {
    await ELECTRON_DEPLOY();
} catch (e) {
    console.error(e);
    notifyError("Failed to deploy for electron", false);
}
try {
    IOS_DEPLOY();
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
try {
    DOCKER_DEPLOY();
} catch (e) {
    console.error(e);
    notifyError("Failed to deploy for docker", false);
}

const end = new Date();

console.log(
    `Released ${currentVersion} (${commitNumber}) - ${commit.slice(0, 8)} (${branch})`
);
console.log("----------------");
console.log(`Started at ${start.toLocaleString()}`);
console.log(`Ended at ${end.toLocaleString()}`);
console.log(`Took ${prettyMs(end.getTime() - start.getTime())}`);

setTimeout(waitForNextCommit, 1000 * 60 * 10); // 10 min
