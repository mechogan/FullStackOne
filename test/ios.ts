import child_process from "child_process";

// make esbuild ios
child_process.execSync("make ios", {
    stdio: "inherit",
    cwd: "platform/ios/esbuild"
});

// build ios
child_process.execSync(
    "xcodebuild -project ./FullStacked.xcodeproj -scheme FullStacked build",
    {
        stdio: "inherit",
        cwd: "platform/ios/xcode"
    }
);

process.exit(0);
