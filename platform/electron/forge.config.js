module.exports = {
  packagerConfig: {
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
      config: {
        options: {
          icon: 'icons/icon.png'
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [],
};
