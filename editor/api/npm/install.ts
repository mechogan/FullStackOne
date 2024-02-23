import type { fs as globalFS, fetch as globalFetch } from "../../../src/api";

declare var fetch: typeof globalFetch;
declare var fs: typeof globalFS;
declare var untar: (to: string, tarData: number[] | Uint8Array) => void;


export default async function(
    outdir: string, 
    packageName: string, 
    version = "latest"
){
    const packageInfoStr = (await fetch.UTF8(`https://registry.npmjs.org/${packageName}/${version}`)).body;
    const packageInfo = JSON.parse(packageInfoStr);
    const tarbalUrl = packageInfo.dist.tarball;
    const tarballData = (await fetch.data(tarbalUrl)).body;
    outdir += "/" + packageName;
    fs.mkdir(outdir);
    untar(outdir, tarballData);
}