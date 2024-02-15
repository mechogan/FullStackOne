import path from "path";
import fs from "fs";
import https from "https";
import tar from "tar";
import { pkgAndSubpathForCurrentPlatform } from "../../../lib/esbuild/lib/npm/node-platform";
// @ts-ignore
import esbuildVersion from "../../../lib/esbuild/version.txt";

const outdir = path.resolve(process.resourcesPath, "esbuild");
if(!fs.existsSync(outdir))
    fs.mkdirSync(outdir, { recursive: true });
const esbuildOutdir = path.join(outdir, "esbuild");

const { pkg, subpath } = pkgAndSubpathForCurrentPlatform();
const esbuildBinOutdir = path.join(outdir, pkg);

export const loadEsbuild = async () => {
    // dont download in dev
    try {
        global.esbuild = await import("esbuild");
    } catch (e) {}

    if(global.esbuild) return;
    
    process.env.ESBUILD_BINARY_PATH = path.resolve(esbuildBinOutdir, subpath);
    global.esbuild = await import(path.resolve(esbuildOutdir, "lib", "main.js"));
}

export const installEsbuild = async () => {
    const esbuildResponse = await fetch(`https://registry.npmjs.org/esbuild/${esbuildVersion}`);
    const esbuildPackage = await esbuildResponse.json();
    const esbuildtarballUrl = esbuildPackage.dist.tarball;
    const esbuildTarball = "esbuild.tgz";
    const esbuildWiteStream = fs.createWriteStream(esbuildTarball);

    await new Promise(resolve => {
      https.get(esbuildtarballUrl, (res) => {
        res.pipe(esbuildWiteStream);
        esbuildWiteStream.on("close", resolve)
      });
    });

    const esbuildOutdir = path.join(outdir, "esbuild");
    fs.mkdirSync(esbuildOutdir, { recursive: true });
    await tar.extract({
      file: esbuildTarball,
      strip: 1,
      C: esbuildOutdir
    });


    const { pkg, subpath } = pkgAndSubpathForCurrentPlatform();
    const npmResponse = await fetch(`https://registry.npmjs.org/${pkg}/${esbuildVersion}`);
    const latestEsbuild = await npmResponse.json();
    const tarballUrl = latestEsbuild.dist.tarball;
    const tarball = "esbuild.tgz";
    const writeStream = fs.createWriteStream(tarball);

    await new Promise(resolve => {
      https.get(tarballUrl, (res) => {
        res.pipe(writeStream);
        writeStream.on("close", resolve)
      });
    });

    const esbuildBinOutdir = path.join(outdir, pkg);
    fs.mkdirSync(esbuildBinOutdir, { recursive: true });
    await tar.extract({
      file: tarball,
      strip: 1,
      C: esbuildBinOutdir
    });
}