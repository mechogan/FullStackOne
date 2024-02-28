import path from "path";
import AdmZip from "adm-zip";
import { buildWebview } from "./build";
import { JavaScript } from "./javascript";

export default function (home: string, js: JavaScript, jsDir: string) {
    const resolvePath = (entrypoint: string) =>
        path.join(home, entrypoint).split("\\").join("/");

    js.ctx.jsDirectory = jsDir;
    js.ctx.resolvePath = resolvePath;
    js.ctx.buildWebview = (entryPoint: string, outdir: string) => {
        const maybeErrors = buildWebview(
            resolvePath(entryPoint),
            resolvePath(outdir)
        );

        if (maybeErrors?.errors) {
            js.push("buildError", JSON.stringify(maybeErrors.errors));
            return false;
        }

        return true;
    };
    js.ctx.zip = (projectdir: string, items: string[], to: string) => {
        var zip = new AdmZip();
        items.forEach((item) => {
            const itemPathComponents = item.split("/");
            const itemName = itemPathComponents.pop();
            const itemDirectory = itemPathComponents.join("/");
            const realpath = resolvePath(projectdir + "/" + item);
            zip.addLocalFile(realpath, itemDirectory, itemName);
        });

        const out = resolvePath(to);
        zip.writeZip(out);
        return out.split("/").slice(0, -1).join("/");
    };
    js.ctx.unzip = (to: string, zipData: Uint8Array) => {
        const zip = new AdmZip(Buffer.from(zipData));
        zip.extractAllTo(resolvePath(to));
    };
}
