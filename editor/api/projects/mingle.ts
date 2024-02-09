import type { fs as globalFS} from "../../../src/api";

declare var fs: typeof globalFS;
declare var jsDirectory: string;
declare var resolvePath: (entrypoint: string) => string;

const cacheDirectory = ".cache/fullstacked";
const mkCacheDir = () => {
    if(!fs.exists(cacheDirectory))
        fs.mkdir(cacheDirectory);
}

export const mingleWebview = (entryPoint: string) => {
    const mergedContent = 
`${fs.readfileUTF8(jsDirectory + "/webview.js", true)}
import("${resolvePath(entryPoint)}");`;

    mkCacheDir();
    const tmpFile = `${cacheDirectory}/tmp-${Date.now()}.js`;
    fs.putfileUTF8(tmpFile, mergedContent);
    return tmpFile;
}

export const mingleAPI = (entryPoint: string) => {
    let mergedContent = `${fs.readfileUTF8(jsDirectory + "/api.js", true)}`

    if(fs.exists(resolvePath(entryPoint), true)){
        mergedContent += `methods = Object.assign(methods, require("${resolvePath(entryPoint)}")?.default ?? {});`;
    }

    mkCacheDir();
    const tmpFile = `${cacheDirectory}/tmp-${Date.now()}.js`;
    fs.putfileUTF8(tmpFile, mergedContent);
    return tmpFile;
}