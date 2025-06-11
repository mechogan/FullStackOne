import path from "node:path";
import url from "node:url";
import fs from "node:fs";
import child_process from "node:child_process";
import dotenv from "dotenv";
import version from "../../version.js";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import prettyBytes from "pretty-bytes";

const currentDirectory = path.dirname(url.fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(currentDirectory, "..", "..");

// build editor

child_process.execSync("npm run build -- --production", {
    cwd: rootDirectory,
    stdio: "inherit"
});

// // build core

// child_process.execSync("make darwin-static ios-arm64 -j4", {
//     cwd: path.resolve(rootDirectory, "core", "build"),
//     stdio: "inherit"
// });

// // update version
const versionStr = `${version.major}.${version.minor}.${version.patch}`;

// const xcodeProj = path.resolve(currentDirectory, "FullStacked.xcodeproj");
// const xcodeFile = path.resolve(xcodeProj, "project.pbxproj");
// const xcodeFileContent = fs.readFileSync(xcodeFile, { encoding: "utf-8" });
// const xcodeFileUpdated = xcodeFileContent
//     .replace(
//         /MARKETING_VERSION = .*?;/g,
//         `MARKETING_VERSION = ${version};`
//     )
//     .replace(
//         /CURRENT_PROJECT_VERSION = .*?;/g,
//         `CURRENT_PROJECT_VERSION = ${version.build};`
//     );
// fs.writeFileSync(xcodeFile, xcodeFileUpdated);

// // clean

// const out = path.resolve(currentDirectory, "out");

// if (fs.existsSync(out)) {
//     fs.rmSync(out, { recursive: true });
// }

// // xcode build

// const optionsPlist = path.resolve(currentDirectory, "exportOptions.plist");

// const schemeiOS = "FullStacked-iOS";
// const archivePathiOS = path.resolve(out, schemeiOS, "FullStacked.xcarchive");
// const pkgDirectoryiOS = path.resolve(out, schemeiOS, "pkg");

// child_process.execSync(
//     `xcodebuild -project ${xcodeProj} -scheme ${schemeiOS} -sdk iphoneos -configuration Release clean`,
//     {
//         stdio: "inherit"
//     }
// );
// child_process.execSync(
//     `xcodebuild -project ${xcodeProj} -scheme ${schemeiOS} -sdk iphoneos -configuration Release archive -archivePath ${archivePathiOS}`,
//     {
//         stdio: "inherit"
//     }
// );
// child_process.execSync(
//     `xcodebuild -exportArchive -archivePath ${archivePathiOS} -exportOptionsPlist ${optionsPlist} -exportPath ${pkgDirectoryiOS} -allowProvisioningUpdates`,
//     {
//         stdio: "inherit"
//     }
// );

// const schemeMacOS = "FullStacked-MacOS";
// const archivePathMacOS = path.resolve(
//     out,
//     schemeMacOS,
//     "FullStacked.xcarchive"
// );
// const pkgDirectoryMacOS = path.resolve(out, schemeMacOS, "pkg");

// child_process.execSync(
//     `xcodebuild -project ${xcodeProj} -scheme ${schemeMacOS} -sdk macosx -configuration Release clean`,
//     {
//         stdio: "inherit"
//     }
// );
// child_process.execSync(
//     `xcodebuild -project ${xcodeProj} -scheme ${schemeMacOS} -sdk macosx -configuration Release archive -archivePath ${archivePathMacOS}`,
//     {
//         stdio: "inherit"
//     }
// );
// child_process.execSync(
//     `xcodebuild -exportArchive -archivePath ${archivePathMacOS} -exportOptionsPlist ${optionsPlist} -exportPath ${pkgDirectoryMacOS} -allowProvisioningUpdates`,
//     {
//         stdio: "inherit"
//     }
// );

// // app store upload

// const appleKeys = dotenv.parse(
//     fs.readFileSync(path.resolve(currentDirectory, "APPLE_KEYS.env"))
// );

// const bundleiOS = path.resolve(pkgDirectoryiOS, "FullStacked.ipa");
// child_process.execSync(
//     `xcrun altool --upload-app --file ${bundleiOS} -t ios --apiKey ${appleKeys.APPLE_API_KEY_ID} --apiIssuer ${appleKeys.APPLE_API_ISSUER} --show-progress`,
//     {
//         stdio: "inherit",
//         env: {
//             API_PRIVATE_KEYS_DIR: appleKeys.APPLE_API_KEY_DIRECTORY
//         }
//     }
// );

// const bundleMacOS = path.resolve(pkgDirectoryMacOS, "FullStacked.pkg");
// child_process.execSync(
//     `xcrun altool --upload-app --file ${bundleMacOS} -t macosx --apiKey ${appleKeys.APPLE_API_KEY_ID} --apiIssuer ${appleKeys.APPLE_API_ISSUER} --show-progress`,
//     {
//         stdio: "inherit",
//         env: {
//             API_PRIVATE_KEYS_DIR: appleKeys.APPLE_API_KEY_DIRECTORY
//         }
//     }
// );

// upload shared libs

child_process.execSync("make darwin-x64-shared darwin-arm64-shared -j4", {
    cwd: path.resolve(rootDirectory, "core", "build"),
    stdio: "inherit"
});

const credentialsCF = dotenv.parse(
    fs.readFileSync(path.resolve(currentDirectory, "CLOUDFLARE.env"))
);

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${credentialsCF.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: credentialsCF.R2_ACCESS_KEY_ID,
        secretAccessKey: credentialsCF.R2_SECRET_ACCESS_KEY,
    },
});

const isRelease = process.argv.includes("--release")

await uploadSharedLibBinary("x64");
await uploadSharedLibBinary("arm64");

function uploadSharedLibBinary(arch) {
    const binaryFilePath = path.resolve(rootDirectory, "core", "bin", "darwin-" + arch + ".so");
    console.log(`Uploading [${binaryFilePath}] ${prettyBytes(fs.statSync(binaryFilePath).size)}`)
    const fileBuffer = fs.readFileSync(binaryFilePath);
    const fileName = isRelease ? `darwin-${arch}.so` : `darwin-${arch}-${version.build}.so`;
    const s3Key = `lib/darwin/${arch}/${versionStr}/${fileName}`;

    const uploadCommand = new PutObjectCommand({
        Bucket: credentialsCF.R2_BUCKET_NAME,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: 'application/octet-stream'
    });

    return s3Client.send(uploadCommand);
}