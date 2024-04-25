import path from "path";
import fs from "fs";
import https from "https";
import tar from "tar";
import { pkgAndSubpathForCurrentPlatform } from "../../../lib/esbuild/lib/npm/node-platform";
// @ts-ignore
import esbuildVersion from "../../../lib/esbuild/version.txt";
import url from "url";

const directories = (configDirectory: string) => {
    const out = path.resolve(configDirectory, "esbuild");
    const esbuildDir = path.join(out, "esbuild");
    const { pkg, subpath } = pkgAndSubpathForCurrentPlatform();
    const esbuildBin = path.join(out, pkg);
    const esbuildBinSub = path.join(esbuildBin, subpath);
    const versionFile = path.resolve(out, "version.txt");
    return {
        out,
        pkg,
        esbuildDir,
        esbuildBin,
        esbuildBinSub,
        versionFile
    };
};

export const loadEsbuild = async (configDirectory: string) => {
    // dont download in dev
    try {
        const esbuild = await import("esbuild");
        return esbuild;
    } catch (e) {}

    const { esbuildDir, esbuildBinSub, versionFile } =
        directories(configDirectory);

    const installedVersion = fs.existsSync(versionFile)
        ? fs.readFileSync(versionFile).toString().trim()
        : null;

    console.log(installedVersion, esbuildVersion);

    if (installedVersion?.trim() !== esbuildVersion?.trim()) {
        return;
    }

    try {
        process.env.ESBUILD_BINARY_PATH = esbuildBinSub;
        const esbuild = await import(
            url
                .pathToFileURL(path.resolve(esbuildDir, "lib", "main.js"))
                .toString()
        );
        return esbuild;
    } catch (e) {
        console.log(e);
    }
};

export const installEsbuild = async (
    configDirectory: string,
    progressListener: (data: { step: number; progress: number }) => void
) => {
    const dir = directories(configDirectory);

    if (!fs.existsSync(dir.out)) fs.mkdirSync(dir.out, { recursive: true });

    const esbuildResponse = await fetch(
        `https://registry.npmjs.org/esbuild/${esbuildVersion}`
    );
    const esbuildPackage = await esbuildResponse.json();
    const esbuildtarballUrl = esbuildPackage.dist.tarball;
    const esbuildTarball = path.join(dir.out, "esbuild.tgz");
    const esbuildWiteStream = fs.createWriteStream(esbuildTarball);

    await new Promise((resolve) => {
        https.get(esbuildtarballUrl, (res) => {
            const size = parseInt(res.headers["content-length"] ?? "0");
            let received = 0;
            res.on("data", (chunk) => {
                received += chunk.byteLength;
                esbuildWiteStream.write(chunk);
                const progress = received / size;

                progressListener({
                    step: 0,
                    progress
                });

                if (progress === 1) esbuildWiteStream.close(resolve);
            });
        });
    });

    fs.mkdirSync(dir.esbuildDir, { recursive: true });
    const size = fs.statSync(esbuildTarball).size;
    const esbuildTarReadStream = fs.createReadStream(esbuildTarball);
    const untarWriteStream = tar.x({
        strip: 1,
        C: dir.esbuildDir
    });
    await new Promise<void>((resolve) => {
        let read = 0;
        esbuildTarReadStream.on("data", (chunk) => {
            read += chunk.length;
            const progress = read / size;

            untarWriteStream.write(chunk as Buffer);

            progressListener({
                step: 1,
                progress
            });

            if (progress === 1) resolve();
        });
    });
    fs.rmSync(esbuildTarball);

    const npmResponse = await fetch(
        `https://registry.npmjs.org/${dir.pkg}/${esbuildVersion}`
    );
    const latestEsbuild = await npmResponse.json();
    const tarballUrl = latestEsbuild.dist.tarball;
    const tarball = path.join(dir.out, "esbuild-bin.tgz");
    const writeStream = fs.createWriteStream(tarball);

    await new Promise((resolve) => {
        https.get(tarballUrl, (res) => {
            const size = parseInt(res.headers["content-length"] ?? "0");
            let received = 0;
            res.on("data", (chunk) => {
                received += chunk.byteLength;
                writeStream.write(chunk);
                const progress = received / size;

                progressListener({
                    step: 2,
                    progress
                });

                if (progress === 1) writeStream.close(resolve);
            });
        });
    });

    fs.mkdirSync(dir.esbuildBin, { recursive: true });
    const binSize = fs.statSync(tarball).size;
    const binTarReadStream = fs.createReadStream(tarball);
    const untarBinWriteStream = tar.x({
        strip: 1,
        C: dir.esbuildBin
    });
    await new Promise<void>((resolve) => {
        let read = 0;
        binTarReadStream.on("data", (chunk) => {
            read += chunk.length;
            const progress = read / binSize;

            untarBinWriteStream.write(chunk as Buffer);

            progressListener({
                step: 3,
                progress
            });

            if (progress === 1) resolve();
        });
    });
    fs.rmSync(tarball);

    fs.writeFileSync(dir.versionFile, esbuildVersion);
    return loadEsbuild(configDirectory);
};
