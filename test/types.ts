import child_process from "child_process";

// typecheck
child_process.execSync("npm run typecheck", {
    stdio: "inherit"
});

process.exit(0);
