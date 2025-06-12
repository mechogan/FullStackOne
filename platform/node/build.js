import esbuild from "esbuild";
import child_process from "node:child_process";
import os from "node:os";
import path from "node:path";
import url from "node:url";
import fs from "node:fs";

const currentDirectory = path.dirname(url.fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(currentDirectory, "..", "..");

esbuild.buildSync({
    entryPoints: ["src/index.ts"],
    outfile: "index.js",
    bundle: true,
    format: "esm",
    packages: "external",
    platform: "node"
});

const platform = os.platform();
const arch = os.arch();
const coreBinary = platform + "-" + arch + ".a";

const binding = {
    targets: [
        {
            target_name: "core",
            sources: [
                "bridge.cc",
                "unix.cc"
            ],
            include_dirs: [
                "<!@(node -p \"require('node-addon-api').include\")"
            ],
            defines: [
                "NAPI_DISABLE_CPP_EXCEPTIONS"
            ]
        }
    ]
}

const bindingFilePath = path.resolve(currentDirectory, "gyp", "binding.gyp");
binding.targets[0].libraries = [path.resolve(rootDirectory, "core", "bin", coreBinary)];
fs.writeFileSync(bindingFilePath, JSON.stringify(binding, null, 4));

child_process.execSync("node-gyp configure build", {
    cwd: path.resolve(currentDirectory, "gyp"),
    stdio: "inherit"
});

fs.cpSync(path.resolve(currentDirectory, "gyp", "build", "Release", "core.node"), path.resolve(currentDirectory, "core.node"));