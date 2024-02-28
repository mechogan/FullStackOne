import path from "path";
import fs from "fs";
import https from "https";
import tar from "tar";
import { pkgAndSubpathForCurrentPlatform } from "../../../lib/esbuild/lib/npm/node-platform";
// @ts-ignore
import esbuildVersion from "../../../lib/esbuild/version.txt";
import { JavaScript } from "../../node/src/javascript";
import url from "url";
import os from "os";

const outdir = path.resolve(os.homedir(), ".config", "fullstacked", "esbuild");
const esbuildOutdir = path.join(outdir, "esbuild");

const { pkg, subpath } = pkgAndSubpathForCurrentPlatform();
const esbuildBinOutdir = path.join(outdir, pkg);

const versionFile = path.resolve(outdir, "version.txt");

export const getVersion = () => {
    if (fs.existsSync(versionFile))
        return fs.readFileSync(versionFile).toString();

    return null;
};

export const loadEsbuild = async () => {
    // dont download in dev
    try {
        global.esbuild = await import("esbuild");
    } catch (e) {}

    if (global.esbuild) return;

    process.env.ESBUILD_BINARY_PATH = path.resolve(esbuildBinOutdir, subpath);
    global.esbuild = await import(
        url
            .pathToFileURL(path.resolve(esbuildOutdir, "lib", "main.js"))
            .toString()
    );
};

export const installEsbuild = async (js: JavaScript) => {
    if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });

    const esbuildResponse = await fetch(
        `https://registry.npmjs.org/esbuild/${esbuildVersion}`
    );
    const esbuildPackage = await esbuildResponse.json();
    const esbuildtarballUrl = esbuildPackage.dist.tarball;
    const esbuildTarball = path.join(outdir, "esbuild.tgz");
    const esbuildWiteStream = fs.createWriteStream(esbuildTarball);

    await new Promise((resolve) => {
        https.get(esbuildtarballUrl, (res) => {
            const size = parseInt(res.headers["content-length"] ?? "0");
            let received = 0;
            res.on("data", (chunk) => {
                received += chunk.byteLength;
                esbuildWiteStream.write(chunk);
                const progress = received / size;

                js.push(
                    "esbuildInstall",
                    JSON.stringify({
                        step: 0,
                        progress
                    })
                );

                if (progress === 1) esbuildWiteStream.close(resolve);
            });
        });
    });

    const esbuildOutdir = path.join(outdir, "esbuild");
    fs.mkdirSync(esbuildOutdir, { recursive: true });
    const size = fs.statSync(esbuildTarball).size;
    const esbuildTarReadStream = fs.createReadStream(esbuildTarball);
    const untarWriteStream = tar.x({
        strip: 1,
        C: esbuildOutdir
    });
    await new Promise<void>((resolve) => {
        let read = 0;
        esbuildTarReadStream.on("data", (chunk) => {
            read += chunk.length;
            const progress = read / size;

            untarWriteStream.write(chunk);

            js.push(
                "esbuildInstall",
                JSON.stringify({
                    step: 1,
                    progress
                })
            );

            if (progress === 1) resolve();
        });
    });
    fs.rmSync(esbuildTarball);

    const npmResponse = await fetch(
        `https://registry.npmjs.org/${pkg}/${esbuildVersion}`
    );
    const latestEsbuild = await npmResponse.json();
    const tarballUrl = latestEsbuild.dist.tarball;
    const tarball = path.join(outdir, "esbuild-bin.tgz");
    const writeStream = fs.createWriteStream(tarball);

    await new Promise((resolve) => {
        https.get(tarballUrl, (res) => {
            const size = parseInt(res.headers["content-length"] ?? "0");
            let received = 0;
            res.on("data", (chunk) => {
                received += chunk.byteLength;
                writeStream.write(chunk);
                const progress = received / size;

                js.push(
                    "esbuildInstall",
                    JSON.stringify({
                        step: 2,
                        progress
                    })
                );

                if (progress === 1) writeStream.close(resolve);
            });
        });
    });

    const esbuildBinOutdir = path.join(outdir, pkg);
    fs.mkdirSync(esbuildBinOutdir, { recursive: true });
    const binSize = fs.statSync(tarball).size;
    const binTarReadStream = fs.createReadStream(tarball);
    const untarBinWriteStream = tar.x({
        strip: 1,
        C: esbuildBinOutdir
    });
    await new Promise<void>((resolve) => {
        let read = 0;
        binTarReadStream.on("data", (chunk) => {
            read += chunk.length;
            const progress = read / binSize;

            untarBinWriteStream.write(chunk);

            js.push(
                "esbuildInstall",
                JSON.stringify({
                    step: 3,
                    progress
                })
            );

            if (progress === 1) resolve();
        });
    });
    fs.rmSync(tarball);

    fs.writeFileSync(versionFile, esbuildVersion);
    await loadEsbuild();
};
