import child_process from "child_process";
import path from "path";

child_process.execSync("make clean", {
    stdio: "inherit",
    cwd: path.resolve(process.cwd(), "core", "build")
});

child_process.execSync("make all -j8", {
    stdio: "inherit",
    cwd: path.resolve(process.cwd(), "core", "build")
});

process.exit(0);
