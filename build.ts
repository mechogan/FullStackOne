import { build, Plugin } from "esbuild";
import fs from "fs";
import * as sass from "sass";

if (fs.existsSync("dist"))
  fs.rmSync("dist", { recursive: true });


const scssPlugin: Plugin = {
  name: 'scss',
  setup(build) {
    build.onLoad({ filter: /\.scss$/ }, (args) => ({
      contents: sass.compile(args.path).css,
      loader: 'css',
    }))
  },
}

await build({
  entryPoints: ["src/webview/index.ts"],
  outfile: "dist/webview/index.js",
  loader: {
    ".svg": "text"
  },
  plugins: [scssPlugin],
  bundle: true,
  format: "esm"
});

await build({
  entryPoints: ["src/api/index.ts"],
  outfile: "dist/api/index.js",
  bundle: true,
  globalName: "api",
  format: "iife"
});

fs.cpSync("src/webview/index.html", "dist/webview/index.html");