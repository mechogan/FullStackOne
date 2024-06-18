import "./index.css";
import { PACKAGE_INSTALLER_ID } from "../constants";
import rpc from "../rpc";
import gzip from "gzip-js";
import untar from "js-untar";
import stackNavigation from "../stack-navigation";

export type PackageInfo = {
    name: string;
    version?: string;
    deep?: boolean;
    errored?: boolean;
};

const nodeModulesDirectory = await rpc().directories.nodeModulesDirectory();
const maxPayloadSize = 100000; // 100kb
const maxFilesPerPaylod = 10;

export class PackageInstaller {
    private static progressDialog: {
        container: HTMLDivElement;
        list: HTMLUListElement;
    };
    private static currentInstalls = new Map<string, HTMLDivElement>();

    private static async installPackage(packageInfo: PackageInfo) {
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
        const nodeModulesDirectory = await rpc().directories.nodeModulesDirectory();
        await rpc().fs.mkdir(nodeModulesDirectory + "/" + packageInfo.name, {
            absolutePath: true
        });
        const files: {
            name: string;
            buffer: ArrayBufferLike;
            type: string; // https://en.wikipedia.org/wiki/Tar_(computing)#UStar_format
        }[] = await untar(tarData.buffer);

        let filesToWrite: { path: string; data: Uint8Array }[] = [];

        const writeFiles = async () => {
            await rpc().fs.writeFileMulti(filesToWrite, {
                absolutePath: true,
                recursive: true
            });
            filesToWrite = [];
        };

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type === "5") continue;

            const pathComponents = file.name.split("/").slice(1); // strip 1
            const path = pathComponents.join("/");

            let currentPayloadSize = filesToWrite.reduce(
                (sum, { data }) => sum + data.byteLength,
                0
            );

            if (
                currentPayloadSize >= maxPayloadSize ||
                filesToWrite.length >= maxFilesPerPaylod
            ) {
                await writeFiles();
            }

            filesToWrite.push({
                path:
                    nodeModulesDirectory + "/" + packageInfo.name + "/" + path,
                data: new Uint8Array(file.buffer)
            });

            PackageInstaller.updateProgress(packageInfo.name, {
                progress: i,
                total: files.length
            });
        }

        // maybe leftovers
        if (filesToWrite.length) {
            await writeFiles();
        }

        PackageInstaller.updateProgress(packageInfo.name, {
            progress: 1,
            total: 1
        });
    }

    private static updateProgress(
        packageName: string,
        state: { progress: number; total: number; error?: string }
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
            stackNavigation.lock = true;

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

        if (state.progress === 0 && state.total === -1) {
            progressElement.innerText = state.error;
            return;
        } else if (state.progress === -1) {
            progressElement.innerText = "...waiting";
            return;
        } else if (state.progress === 0) {
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

    static async install(
        packages: PackageInfo[],
        previousInstalls: string[] = []
    ) {
        const packagesToInstall: PackageInfo[] = [];
        packages.forEach((packageInfo) => {
            const packageNameComponents = packageInfo.name.split("/");
            // @some/package
            if (packageNameComponents.at(0).startsWith("@"))
                packageInfo.name = packageNameComponents.slice(0, 2).join("/");
            // react-dom/client
            else packageInfo.name = packageNameComponents.at(0);

            // remove duplicates
            if (packagesToInstall.find(({ name }) => name === packageInfo.name))
                return;

            PackageInstaller.updateProgress(packageInfo.name, {
                progress: -1,
                total: 0
            });

            packagesToInstall.push(packageInfo);
        });

        for (const pacakgeInfo of packagesToInstall) {
            try {
                await PackageInstaller.installPackage(pacakgeInfo);
            } catch (error) {
                PackageInstaller.updateProgress(pacakgeInfo.name, {
                    progress: 0,
                    total: -1,
                    error
                });
                pacakgeInfo.errored = error;
            }
        }

        let retry: boolean;
        if (packagesToInstall.some(({ errored }) => !!errored)) {
            retry = await new Promise<boolean>((resolve) => {
                const buttonGroup = document.createElement("div");
                buttonGroup.classList.add("button-group");

                const ignoreButton = document.createElement("button");
                ignoreButton.classList.add("text");
                ignoreButton.innerText = "Ignore";
                ignoreButton.addEventListener("click", () => resolve(false));
                buttonGroup.append(ignoreButton);

                const retryButton = document.createElement("button");
                retryButton.innerText = "Retry";
                retryButton.addEventListener("click", () => resolve(true));
                buttonGroup.append(retryButton);

                PackageInstaller.progressDialog.container
                    .querySelector(":scope > div")
                    .append(buttonGroup);
            });
        }

        PackageInstaller.progressDialog.container.remove();
        stackNavigation.lock = false;
        PackageInstaller.progressDialog = null;
        PackageInstaller.currentInstalls = new Map();

        if (packagesToInstall.some(({ errored }) => errored) && retry) {
            return PackageInstaller.install(
                packagesToInstall.filter(({ errored }) => errored)
            );
        }

        if (packagesToInstall.every(({ errored }) => errored) && !retry) {
            return packagesToInstall;
        }

        const deepInstalls = packagesToInstall.filter(
            ({ errored, deep }) => deep && !errored
        );
        if (deepInstalls.length === 0) return;

        previousInstalls.push(...deepInstalls.map(({ name }) => name));

        const depsPromises = deepInstalls.map(
            PackageInstaller.getPackageDependencies
        );
        const nextInstall = Array.from(
            new Set((await Promise.all(depsPromises)).flat())
        ).filter((name) => !previousInstalls.includes(name));

        if (nextInstall.length)
            return PackageInstaller.install(
                nextInstall.map((name) => ({
                    name,
                    deep: true
                })),
                previousInstalls
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
