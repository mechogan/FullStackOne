import child_process from "child_process";
import esbuild from "esbuild";

const build = (testFile: string) => {
    const outfile = "test/.cache/test.js";
    esbuild.buildSync({
        entryPoints: [`test/${testFile}`],
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
child_process.execSync(`node ${build("basic.ts")}`, { stdio: "inherit" });

// deep links and git tests
child_process.execSync(`node ${build("deeplink-git.ts")}`, {
    stdio: "inherit"
});

// ios
// child_process.execSync(`node ${build("ios.ts")}`, { stdio: "inherit" });

// webcontainer
child_process.execSync(`node ${build("webcontainer/test.ts")}`, {
    stdio: "inherit"
});
