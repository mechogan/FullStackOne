import rpc from "../../rpc";
import gzip from "gzip-js";
import untar from "js-untar";


export default {
    async install(packageName: string, version = "latest"){
        const packageInfoStr = (
            await rpc().fetch(`https://registry.npmjs.org/${packageName}/${version}`, {
                encoding: "utf8"
            })
        ).body as string;
        const packageInfo = JSON.parse(packageInfoStr);
        const tarbalUrl = packageInfo.dist.tarball;
        const tarballData = (await rpc().fetch(tarbalUrl)).body as Uint8Array;
        const tarData = new Uint8Array(gzip.unzip(tarballData));
        const nodeModulesDirectory = await rpc().directories.nodeModules();
        await rpc().fs.mkdir(nodeModulesDirectory + "/" + packageName, { absolutePath: true });
        const files: {
            name: string,
            buffer: ArrayBufferLike
        }[] = await untar(tarData.buffer);
        for(const file of files) {
            const pathComponents = file.name.slice("package/". length).split("/");
            const filename = pathComponents.pop();
            const directory = pathComponents.join("/");
            await rpc().fs.mkdir(nodeModulesDirectory + "/" + packageName + "/" + directory, { absolutePath: true });
            await rpc().fs.writeFile(nodeModulesDirectory + "/" + packageName + "/" + directory + "/" + filename, new Uint8Array(file.buffer), { absolutePath: true });
        }
    },
    async count() {
        const nodeModulesDirectory = await rpc().directories.nodeModules();
        if (!(await rpc().fs.exists(nodeModulesDirectory, { absolutePath: true }))) return 0;
        return (await rpc().fs.readdir(nodeModulesDirectory, { withFileTypes: false, absolutePath: true })).length;
    }
};
