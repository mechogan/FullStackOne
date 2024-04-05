import "./index.css";
import { PACKAGE_INSTALLER_ID } from "../constants";
import rpc from "../rpc";
import gzip from "gzip-js";
import untar from "js-untar";

export type PackageInfo = {
    name: string;
    version?: string;
    deep?: boolean;
};

const nodeModulesDirectory = await rpc().directories.nodeModules();

export class PackageInstaller {
    private static progressDialog: {
        container: HTMLDivElement;
        list: HTMLUListElement;
    };
    private static currentInstalls = new Map<string, HTMLDivElement>();

    private static async installPackage(packageInfo: PackageInfo) {
        if (packageInfo.name.startsWith("."))
            throw `Package name starts with ".". [${packageInfo.name}]`;

        const packageNameComponents = packageInfo.name.split("/");
        // @some/package
        if (packageNameComponents.at(0).startsWith("@"))
            packageInfo.name = packageNameComponents.slice(0, 2).join("/");
        // react-dom/client
        else packageInfo.name = packageNameComponents.at(0);

        // const worker = new Worker("/worker-package.js", { type: "module" });
        PackageInstaller.updateProgress(packageInfo.name, {
            progress: 0,
            total: 1
        });


        const packageInfoStr = (
            await rpc().fetch(
                `https://registry.npmjs.org/${packageInfo.name}/${packageInfo.version || "latest"}`,
                {
                    encoding: "utf8"
                }
            )
        ).body as string;
        const packageInfoJSON = JSON.parse(packageInfoStr);
        const tarbalUrl = packageInfoJSON.dist.tarball;
        const tarballData = (await rpc().fetch(tarbalUrl)).body as Uint8Array;
        const tarData = new Uint8Array(gzip.unzip(tarballData));
        const nodeModulesDirectory = await rpc().directories.nodeModules();
        await rpc().fs.mkdir(nodeModulesDirectory + "/" + packageInfo.name, {
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
                nodeModulesDirectory + "/" + packageInfo.name + "/" + directory;
            if (!directoriesToCreate.has(directoryToCreate)) {
                directoriesToCreate.add(directoryToCreate);
                await rpc().fs.mkdir(directoryToCreate, { absolutePath: true });
            }
    
            await rpc().fs.writeFile(
                nodeModulesDirectory +
                    "/" +
                    packageInfo.name +
                    "/" +
                    directory +
                    "/" +
                    filename,
                new Uint8Array(file.buffer),
                { absolutePath: true }
            );
            PackageInstaller.updateProgress(packageInfo.name, { progress: i, total: files.length });
        }

        PackageInstaller.updateProgress(packageInfo.name, {
            progress: 1,
            total: 1
        });
    }

    private static updateProgress(
        packageName: string,
        state: { progress: number; total: number }
    ) {
        if (!PackageInstaller.progressDialog) {
            const container = document.createElement("div");
            container.id = PACKAGE_INSTALLER_ID;
            container.classList.add("dialog");

            const inner = document.createElement("div");
            inner.innerHTML = `<h1>Dependencies</h1>`;

            const list = document.createElement("ul");
            inner.append(list);

            container.append(inner);
            document.body.append(container);

            PackageInstaller.progressDialog = {
                container,
                list
            };
        }

        let progressElement = PackageInstaller.currentInstalls.get(packageName);
        if (!progressElement) {
            progressElement = document.createElement("div");
            const li = document.createElement("li");
            li.innerHTML = `<div>${packageName}</div>`;
            li.append(progressElement);
            PackageInstaller.progressDialog.list.append(li);
            PackageInstaller.currentInstalls.set(packageName, progressElement);
        }

        if (state.progress === 0) {
            progressElement.innerText = "...installing";
            return;
        } else if (state.progress === state.total) {
            progressElement.innerText = "installed";
            return;
        }

        const percent =
            Math.floor((state.progress / state.total) * 10000) / 100;
        progressElement.innerText = `${state.progress}/${state.total} [${percent}%] installing`;
    }

    static async install(packages: PackageInfo[]) {
        const installPromises = packages.map(PackageInstaller.installPackage);
        try {
            await Promise.all(installPromises);
        } catch (e) {
            throw e;
        }
        PackageInstaller.progressDialog.container.remove();
        PackageInstaller.progressDialog = null;
        PackageInstaller.currentInstalls = new Map();

        const deepInstalls = packages.filter(({ deep }) => deep);
        if (deepInstalls.length === 0) return;

        const depsPromises = deepInstalls.map(
            PackageInstaller.getPackageDependencies
        );
        const nextInstall = Array.from(
            new Set((await Promise.all(depsPromises)).flat())
        );
        return PackageInstaller.install(
            nextInstall.map((name) => ({ name, deep: true }))
        );
    }

    static async getPackageDependencies(packageInfo: PackageInfo) {
        const packageJSONStr = (await rpc().fs.readFile(
            nodeModulesDirectory + "/" + packageInfo.name + "/package.json",
            {
                encoding: "utf8",
                absolutePath: true
            }
        )) as string;
        const packageJSON = JSON.parse(packageJSONStr);
        return Object.keys(packageJSON.dependencies || {});
    }
}
