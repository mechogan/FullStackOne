const fs = require("fs");
const dotenv = require("dotenv");

let appleKeys;
if (fs.existsSync("../ios/APPLE_KEYS.env")) {
    appleKeys = dotenv.parse(fs.readFileSync("../ios/APPLE_KEYS.env"));
}

module.exports = {
    packagerConfig: {
        icon: "icons/icon",
        asar: false,
        ignore: [],
        osxSign: {
            identity: appleKeys?.APPLE_ID
        },
        osxNotarize: {
            tool: "notarytool",
            appleApiKey:
                appleKeys?.APPLE_API_KEY_DIRECTORY +
                `/AuthKey_${appleKeys?.APPLE_API_KEY_ID}.p8`,
            appleApiKeyId: appleKeys?.APPLE_API_KEY_ID,
            appleApiIssuer: appleKeys?.APPLE_API_ISSUER
        },
        protocols: [
            {
                name: "Open in FullStacked",
                schemes: ["fullstacked"]
            }
        ]
    },
    rebuildConfig: {},
    makers: [
        {
            name: "@electron-forge/maker-squirrel",
            config: {
                iconUrl: "https://files.fullstacked.org/icon.ico",
                setupIcon: "icons/icon.ico",
                icon: "icons/icon.ico"
            }
        },
        {
            name: "@electron-forge/maker-zip",
            platforms: ["darwin"]
        },
        {
            name: "@electron-forge/maker-deb",
            config: {
                options: {
                    icon: "icons/icon.png",
                    mimeType: ["x-scheme-handler/fullstacked"]
                }
            }
        },
        {
            name: "@electron-forge/maker-rpm",
            config: {
                options: {
                    icon: "icons/icon.png"
                }
            }
        }
    ],
    plugins: []
};
