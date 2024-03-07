import semver from "semver";
import fs from "fs";

const version = process.argv.at(-1);
if (!semver.valid(version)) throw `Invalide version [${version}]`;

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

const xcodeFile = "platform/ios/xcode/FullStacked.xcodeproj/project.pbxproj";
const content = fs.readFileSync(xcodeFile, { encoding: "utf-8" });
const updated = content.replace(
    /MARKETING_VERSION = .*?;/g,
    (value) => `MARKETING_VERSION = ${version};`
);
fs.writeFileSync(xcodeFile, updated);
