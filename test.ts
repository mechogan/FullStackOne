import path from "path";
import child_process from "child_process";

// test build
await import("./build");

// test node build
child_process.execSync("npm run build", {
    cwd: "platform/node",
    stdio: "inherit",
});

// test functionalities with node
process.env.NO_OPEN = "1";
await import(process.cwd() + "/platform/node/index.js");
