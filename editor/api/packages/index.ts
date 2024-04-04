import rpc from "../../rpc";
import gzip from "gzip-js";
import untar from "js-untar";

export default {
    async install(
        packageName: string,
        progress: (current: number, total: number) => void,
        version = "latest"
    ) {
        const packageInfoStr = (
            await rpc().fetch(
                `https://registry.npmjs.org/${packageName}/${version}`,
                {
                    encoding: "utf8"
                }
            )
        ).body as string;
        const packageInfo = JSON.parse(packageInfoStr);
        const tarbalUrl = packageInfo.dist.tarball;
        const tarballData = (await rpc().fetch(tarbalUrl)).body as Uint8Array;
        const tarData = new Uint8Array(gzip.unzip(tarballData));
        const nodeModulesDirectory = await rpc().directories.nodeModules();
        await rpc().fs.mkdir(nodeModulesDirectory + "/" + packageName, {
            absolutePath: true
        });
        const files: {
            name: string;
            buffer: ArrayBufferLike;
            type: string; // https://en.wikipedia.org/wiki/Tar_(computing)#UStar_format
        }[] = await untar(tarData.buffer);
        const directoriesToCreate = new Set<string>();
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type === "5") continue;

            const pathComponents = file.name.split("/").slice(1);
            const filename = pathComponents.pop();
            const directory = pathComponents.join("/");

            const directoryToCreate =
                nodeModulesDirectory + "/" + packageName + "/" + directory;
            if (!directoriesToCreate.has(directoryToCreate)) {
                directoriesToCreate.add(directoryToCreate);
                await rpc().fs.mkdir(directoryToCreate, { absolutePath: true });
            }

            await rpc().fs.writeFile(
                nodeModulesDirectory +
                    "/" +
                    packageName +
                    "/" +
                    directory +
                    "/" +
                    filename,
                new Uint8Array(file.buffer),
                { absolutePath: true }
            );
            if (progress) progress(i, files.length);
        }
    },
    async count() {
        const nodeModulesDirectory = await rpc().directories.nodeModules();
        if (
            !(await rpc().fs.exists(nodeModulesDirectory, {
                absolutePath: true
            }))
        )
            return 0;
        return (
            await rpc().fs.readdir(nodeModulesDirectory, {
                withFileTypes: false,
                absolutePath: true
            })
        ).length;
    }
};
