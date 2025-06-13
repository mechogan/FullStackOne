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

fs.cpSync(
    path.resolve(rootDirectory, "out", "editor", "lib"),
    path.resolve(currentDirectory, "lib"),
    { recursive: true }
);

const platform = os.platform();

const archArgIndex = process.argv.indexOf("--arch");
const arch =
    archArgIndex === -1 ? os.arch() : process.argv.at(archArgIndex + 1);

const target_name = platform + "-" + arch;

const binding = {
    targets: [
        {
            target_name,
            sources: ["bridge.cc", platform === "win32" ? "win.cc" : "unix.cc"],
            include_dirs: [
                "<!@(node -p \"require('node-addon-api').include\")"
            ],
            defines: ["NAPI_DISABLE_CPP_EXCEPTIONS"]
        }
    ]
};

const bindingFilePath = path.resolve(currentDirectory, "gyp", "binding.gyp");
fs.writeFileSync(bindingFilePath, JSON.stringify(binding, null, 4));

child_process.execSync(`node-gyp --arch=${arch} clean configure build`, {
    cwd: path.resolve(currentDirectory, "gyp"),
    stdio: "inherit"
});

fs.cpSync(
    path.resolve(
        currentDirectory,
        "gyp",
        "build",
        "Release",
        target_name + ".node"
    ),
    path.resolve(currentDirectory, target_name + ".node")
);
