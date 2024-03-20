import { configdir } from "../config";

export const nodeModulesDir = configdir + "/node_modules";

export default async function (packageName: string, version = "latest") {
    const packageInfoStr = (
        await fetch(`https://registry.npmjs.org/${packageName}/${version}`, {
            encoding: "utf8"
        })
    ).body as string;
    const packageInfo = JSON.parse(packageInfoStr);
    const tarbalUrl = packageInfo.dist.tarball;
    const tarballData = (await fetch(tarbalUrl)).body as Uint8Array;
    const outdir = nodeModulesDir + "/" + packageName;
    await fs.mkdir(outdir);
    await untar(outdir, tarballData);
}
