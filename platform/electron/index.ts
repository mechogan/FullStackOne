import { app, BrowserWindow } from "electron"
import { pkgAndSubpathForCurrentPlatform } from "../../lib/esbuild/lib/npm/node-platform";
//@ts-ignore
import esbuildVersion from "../../lib/esbuild/version.txt";
import https from "https";
import fs from "fs";
import tar from "tar";
import path from "path";
import { mainServer } from "../node"

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
  });

  mainWindow.loadURL(`http://localhost:${mainServer.port}`)

  const outdir = "esbuild"
  fs.mkdirSync(outdir, { recursive: true });

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

  process.env.ESBUILD_BINARY_PATH = path.resolve(esbuildBinOutdir, subpath);
  global.esbuild = await import(path.resolve(esbuildOutdir, "lib", "main.js"));
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0)
      createWindow()
  })
})

app.on('window-all-closed', () => app.quit())
