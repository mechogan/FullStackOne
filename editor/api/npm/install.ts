import type { fs as globalFS, fetch as globalFetch } from "../../../src/api";
import { configdir } from "../config";

declare var fetch: typeof globalFetch;
declare var fs: typeof globalFS;
declare var untar: (to: string, tarData: number[] | Uint8Array) => void | Promise<void>;

export const nodeModulesDir = configdir + "/node_modules";

export default async function(
    packageName: string, 
    version = "latest"
){
    const packageInfoStr = (await fetch.UTF8(`https://registry.npmjs.org/${packageName}/${version}`)).body;
    const packageInfo = JSON.parse(packageInfoStr);
    const tarbalUrl = packageInfo.dist.tarball;
    const tarballData = (await fetch.data(tarbalUrl)).body;
    const outdir =  nodeModulesDir + "/" + packageName;
    fs.mkdir(outdir);
    await untar(outdir, tarballData);
}