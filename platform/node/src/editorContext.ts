import { Context } from "vm";
import path from "path";
import AdmZip from "adm-zip";
import { buildWebview } from "./build";

export default function(home: string, jsContext: Context) {
    const resolvePath = (entrypoint: string) => path.join(home, entrypoint).split("\\").join("/");

    jsContext.jsDirectory = path.resolve(process.cwd(), "..", "..", "src", "js");
    jsContext.resolvePath = resolvePath;
    jsContext.buildWebview = (entryPoint: string, outdir: string) => buildWebview(resolvePath(entryPoint), resolvePath(outdir));
    jsContext.zip = (projectdir: string, items: string[], to: string) => {
        var zip = new AdmZip();
        items.forEach(item => {
            const itemPathComponents = item.split("/");
            const itemName = itemPathComponents.pop();
            const itemDirectory = itemPathComponents.join("/");
            const realpath = resolvePath(projectdir + "/" + item);
            zip.addLocalFile(realpath, itemDirectory, itemName);
        });

        const out = resolvePath(to);
        zip.writeZip(out);
        return out.split("/").slice(0, -1).join("/");
    }
    jsContext.unzip = (to: string, zipData: number[] | Uint8Array) => {
        const zip = new AdmZip(Buffer.from(zipData))
        zip.extractAllTo(resolvePath(to));
    }
}