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
      config: {},
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
