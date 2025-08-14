import child_process from "node:child_process";
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

const cacheDirectory = path.resolve("test", ".cache");

fs.rmSync(cacheDirectory, { recursive: true })

const build = (testFile: string) => {
    const outfile = path.resolve(cacheDirectory, "test.js");
    esbuild.buildSync({
        entryPoints: [path.resolve("test", testFile)],
        outfile,
        bundle: true,
        packages: "external",
        format: "esm"
    });
    return outfile;
};

// type checking
// child_process.execSync(`node ${build("types.ts")}`, { stdio: "inherit" });

// basic tests
// child_process.execSync(`node ${build("basic.ts")}`, {
//     stdio: "inherit"
// });

// deep links and git clone tests
// child_process.execSync(`node ${build("deeplink-git.ts")}`, {
//     stdio: "inherit"
// });

// git commit and auto-update
child_process.execSync(`node ${build("commit-auto-update.ts")}`, {
    stdio: "inherit"
});