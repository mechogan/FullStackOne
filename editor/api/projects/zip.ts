import { Adapter } from "../../../src/adapter/fullstacked";
import { scan } from "./scan";
import * as zip from "@zip.js/zip.js";

export default async function (
    directory: string,
    readFileFn: Adapter["fs"]["readFile"],
    readdirFn: Adapter["fs"]["readdir"],
    ignore?: (file: string) => boolean
) {
    const files = (await scan(directory, readdirFn)) as string[];

    const uint8ArrayWriter = new zip.Uint8ArrayWriter();
    const zipWriter = new zip.ZipWriter(uint8ArrayWriter);
    for (const file of files) {
        const filename = file.slice(directory.length + 1);
        if (ignore && ignore(filename)) continue;
        await zipWriter.add(
            filename,
            new zip.Uint8ArrayReader((await readFileFn(file)) as Uint8Array)
        );
    }

    await zipWriter.close();
    return uint8ArrayWriter.getData();
}
