module.exports = {
  packagerConfig: {
    // asar: true,
    ignore: [
      ".cache/build.mjs",
      "esbuild",
      "out",
      ".gitignore",
      "build.ts",
      "esbuild.tgz",
      "forge.config.js",
      "index.ts"
    ],
    extraResource: [
      "../../dist"
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
