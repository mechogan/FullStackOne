import http, { get } from "http";
import esbuild from "esbuild";
import path from "path";
import url from "url";
import fs from "fs";
import child_process from "child_process";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// delete any .tgz in platform/node
const platformNodeDir = path.resolve(__dirname, "..", "..", "platform", "node");
const getAllTgzFiles = async () =>
    (await fs.promises.readdir(platformNodeDir)).filter((file) =>
        file.endsWith(".tgz")
    );
const tgzFiles = await getAllTgzFiles();
const rmPromises = tgzFiles.map((file) =>
    fs.promises.rm(
        path.resolve(
            path.resolve(__dirname, "..", "..", "platform", "node", file)
        )
    )
);
await Promise.all(rmPromises);

// pack platform/node
child_process.execSync("npm pack", { cwd: platformNodeDir, stdio: "inherit" });

// get data from .tgz file
const builtTgz = (await getAllTgzFiles()).at(0);
if (!builtTgz) throw "No built package in platform/node";
const builtTgzBin = await fs.promises.readFile(
    path.resolve(platformNodeDir, builtTgz)
);

const build = esbuild.buildSync({
    entryPoints: [path.resolve(__dirname, "client.ts")],
    bundle: true,
    format: "esm",
    write: false
});
const js = build.outputFiles.at(0).text;

const server = http.createServer((req, res) => {
    if (req.url.endsWith("/build")) {
        res.setHeader("content-type", "application/octet-stream");
        res.end(builtTgzBin);
        return;
    }

    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("content-type", "text/html");
    res.end(html);
});

server.listen(9000);
console.log("ready");

const html = `
<style>
${await fs.promises.readFile(path.resolve(__dirname, "..", "..", "node_modules/", "@xterm", "xterm", "css", "xterm.css"))}
</style>
<script type="module">
${js}
</script>`;
