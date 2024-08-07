import semver from "semver";
import fs from "fs";

const version = process.argv.at(-1);
if (!semver.valid(version)) throw `Invalid version [${version}]`;

// main, node, electron
const packagesJSONs = [
    "package.json",
    "platform/node/package.json",
    "platform/electron/package.json"
];

packagesJSONs.forEach((packageJSON) => {
    const json = JSON.parse(fs.readFileSync(packageJSON));
    json.version = version;
    fs.writeFileSync(packageJSON, JSON.stringify(json, null, 4));
});

// iOS
const xcodeFile = "platform/ios/xcode/FullStacked.xcodeproj/project.pbxproj";
const xcodeFileContent = fs.readFileSync(xcodeFile, { encoding: "utf-8" });
const xcodeFileUpdated = xcodeFileContent.replace(
    /MARKETING_VERSION = .*?;/g,
    `MARKETING_VERSION = ${version};`
);
fs.writeFileSync(xcodeFile, xcodeFileUpdated);


// android
const gradleFile = "platform/android/studio/app/build.gradle.kts";
const gradleFileContent = fs.readFileSync(gradleFile, { encoding: "utf-8" });
const gradleFileUpdated = gradleFileContent.replace(
    /versionName = .*?\n/g,
    `versionName = "${version}"\n`
);
fs.writeFileSync(gradleFile, gradleFileUpdated);