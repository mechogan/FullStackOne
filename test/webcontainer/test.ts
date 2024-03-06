import child_process from "child_process";
import path from "path";

const webcontainerDir = path.resolve("test/webcontainer");

child_process.execSync("node index.js", {
    cwd: webcontainerDir,
    stdio: "inherit"
});

process.exit(0);
