require("dotenv").config();

module.exports = {
    packagerConfig: {
        icon: "icons/icon",
        asar: false,
        ignore: [],
        osxSign: {
            identity: process.env.APPLE_ID
        },
        osxNotarize: {
            tool: "notarytool",
            appleApiKey: process.env.APPLE_API_KEY,
            appleApiKeyId: process.env.APPLE_API_KEY_ID,
            appleApiIssuer: process.env.APPLE_API_ISSUER
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
