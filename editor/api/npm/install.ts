import type { fs as globalFS } from "../../../src/api/fs";
import type { fetch as globalFetch } from "../../../src/api/fetch";
import { configdir } from "../config";

declare var fetch: typeof globalFetch;
declare var fs: typeof globalFS;
declare var untar: (to: string, tarData: number[] | Uint8Array) => void | Promise<void>;

export const nodeModulesDir = configdir + "/node_modules";

export default async function(
    packageName: string, 
    version = "latest"
){
    const packageInfoStr = (await fetch(`https://registry.npmjs.org/${packageName}/${version}`, { encoding: "utf8" })).body as string;
    const packageInfo = JSON.parse(packageInfoStr);
    const tarbalUrl = packageInfo.dist.tarball;
    const tarballData = (await fetch(tarbalUrl)).body as Uint8Array;
    const outdir =  nodeModulesDir + "/" + packageName;
    await fs.mkdir(outdir);
    await untar(outdir, tarballData);
}