module.exports = {
  packagerConfig: {
    name: "FullStacked",
    icon: "icons/icon",
    asar: true,
    ignore: [
    ],
    extraResource: [
      "../../Demo.zip"
    ]
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: "FullStacked",
        author: "FullStacked Org.",
        description: "Build and run full-stack JavaScript web apps anywhere.",
        iconUrl: 'https://files.fullstacked.org/icon.ico',
        setupIcon: 'icons/icon.ico',
        icon: "icons/icon.ico",
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [],
};
