import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import url from "node:url";
import cliProgress from "cli-progress";
import prettyBytes from "pretty-bytes";

const currentDirectory = path.dirname(url.fileURLToPath(import.meta.url));

const platform = os.platform();
const arch = os.arch();
const libBinary = platform + "-" + arch + "." + (platform === "win32" ? "dll" : "so");

export async function getLibPath(directory?: string) {
    if (directory) {
        const definedLibPath = path.resolve(currentDirectory, directory, libBinary);
        if (!fs.existsSync(definedLibPath)) {
            throw `Could not find FullStacked library at [${definedLibPath}]`;
        }

        return definedLibPath;
    }

    const libPath = path.resolve(currentDirectory, libBinary);
    if (fs.existsSync(libPath)) {
        return libPath;
    }

    const packageJsonFilePath = path.resolve(currentDirectory, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonFilePath, { encoding: "utf8" }));
    const [version, build] = packageJson.version.split("-");
    const fileName = build
        ? `${platform}-${arch}-${build}.${platform === "win32" ? "dll" : "so"}`
        : libBinary
    const remoteLibUrl = `https://files.fullstacked.org/lib/${platform}/${arch}/${version}/${fileName}`;

    const response = await fetch(remoteLibUrl);
    if (!response.ok) {
        throw `Could not find FullStacked library in remote storage at [${remoteLibUrl}]`;
    }

    const size = parseInt(response.headers.get("content-length"));

    const downloadProgress = new cliProgress.SingleBar({
        formatValue: (v, _, type) => {
            if (type === "total" || type === "value") {
                return prettyBytes(v);
            }
            return v.toString();
        }
    }, cliProgress.Presets.shades_classic);
    downloadProgress.start(size, 0);

    let downloaded = 0;
    const reader = response.body.getReader();
    const writeStream = fs.createWriteStream(libPath, "binary");
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        writeStream.write(value);
        downloaded += value.byteLength;
        downloadProgress.update(downloaded);
    }

    downloadProgress.stop();
    await new Promise(res => writeStream.close(res))

    return libPath;
}

