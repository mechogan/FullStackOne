import type { fs as globalFS} from "../../../src/api";

declare var fs: typeof globalFS;
declare var webviewBase: string;
declare var apiBase: string;
declare var resolvePath: (entrypoint: string) => string;

export const mingleWebview = (entryPoint: string) => {
    const mergedContent = 
`${fs.readfileUTF8(webviewBase, true)}
import("${resolvePath(entryPoint)}");`;

    const tmpFile = `.cache/tmp-${Date.now()}.js`;
    fs.putfileUTF8(tmpFile, mergedContent);
    return tmpFile;
}

export const mingleAPI = (entryPoint: string) => {
    const mergedContent = 
`${fs.readfileUTF8(apiBase, true)}
methods = require("${resolvePath(entryPoint)}").default;`;

    const tmpFile = `.cache/tmp-${Date.now()}.js`;
    fs.putfileUTF8(tmpFile, mergedContent);
    return tmpFile;
}