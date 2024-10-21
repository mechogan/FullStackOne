import rpc from "../../../rpc";
import gzip from "gzip-js";
import untar from "js-untar";
import { Dialog } from "../../../components/dialog";
import { PackagesInstallProgress } from "./progress";

let nodeModulesDirectory: string;

const maxPayloadSize = 100000; // 100kb
const maxFilesPerPaylod = 10;
const concurrentInstallation = 3;
let currentlyInstalling = 0;

let packagesDirectory: string;
let progressView: {
    remove: () => void;
    addPackage: ReturnType<typeof PackagesInstallProgress>["addPackage"];
};

const td = new TextDecoder();

const packagesToInstall: {
    name: string;
    promiseResolve: () => void;
}[] = [];
const installingPackages = new Map<
    string,
    {
        promise: Promise<void>;
        progress: ReturnType<
            ReturnType<typeof PackagesInstallProgress>["addPackage"]
        >;
    }
>();

export const packageInstaller = {
    install
};

function parsePackageName(packageName: string) {
    const packageNameComponents = packageName.split("/");
    // @some/package
    if (packageNameComponents.at(0).startsWith("@")) {
        return packageNameComponents.slice(0, 2).join("/");
    }
    // react-dom/client
    else {
        return packageNameComponents.at(0);
    }
}

async function install(packageName: string) {
    if (!nodeModulesDirectory)
        nodeModulesDirectory = await rpc().directories.nodeModulesDirectory();

    const alreadyInstalled = await checkIfAlreadyInstalled(packageName);
    if (alreadyInstalled) return;

    const name = parsePackageName(packageName);
    let installPromise = installingPackages.get(name);

    if (!installPromise) {
        if (!progressView) {
            renderProgressDialog();
        }

        const progress = progressView.addPackage(name);
        progress.setStatus("waiting");
        const promise = new Promise<void>((promiseResolve) => {
            packagesToInstall.push({
                name,
                promiseResolve
            });
        });

        installPromise = {
            progress,
            promise
        };

        installingPackages.set(name, installPromise);
    }

    installLoop();

    return installPromise.promise;
}

async function checkIfAlreadyInstalled(packageName: string) {
    if (!packagesDirectory) {
        packagesDirectory = await rpc().directories.nodeModulesDirectory();
    }

    const directoryName = parsePackageName(packageName);
    return rpc().fs.exists(`${packagesDirectory}/${directoryName}`, {
        absolutePath: true
    });
}

function installLoop() {
    if (currentlyInstalling === concurrentInstallation) return;

    if (packagesToInstall.length === 0) {
        if (currentlyInstalling === 0) {
            progressView?.remove();
        }
        return;
    }

    currentlyInstalling++;

    const packageToInstall = packagesToInstall.shift();
    const onCompleted = () => {
        packageToInstall.promiseResolve();
        installLoop();
    };
    installPackage(packageToInstall.name).then((deps) => {
        currentlyInstalling--;

        if (!deps) {
            onCompleted();
        } else {
            Promise.all(deps.map(install)).then(onCompleted);
        }
    });
}

function renderProgressDialog() {
    const { container, addPackage } = PackagesInstallProgress();
    const dialog = Dialog(container);
    progressView = {
        remove: () => {
            dialog.remove();
            progressView = null;
        },
        addPackage
    };
}

async function installPackage(name: string) {
    const installingPackage = installingPackages.get(name);

    installingPackage.progress.setStatus("downloading");
    const packageInfoStr = (
        await rpc().fetch(`https://registry.npmjs.org/${name}/latest`, {
            encoding: "utf8"
        })
    ).body as string;
    const packageInfoJSON = JSON.parse(packageInfoStr);
    const tarbalUrl = packageInfoJSON.dist.tarball;
    const tarballData = (await rpc().fetch(tarbalUrl)).body as Uint8Array;

    installingPackage.progress.setStatus("unpacking");
    const tarData = new Uint8Array(gzip.unzip(tarballData));
    await rpc().fs.mkdir(`${nodeModulesDirectory}/${name}`, {
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

    const packageJSONFile = `${nodeModulesDirectory}/${name}/package.json`;
    let deps: string[];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === "5") continue;

        const pathComponents = file.name.split("/").slice(1); // strip 1
        const path = `${nodeModulesDirectory}/${name}/${pathComponents.join("/")}`;

        if (path === packageJSONFile) {
            const packageJSON = JSON.parse(td.decode(file.buffer));
            if (packageJSON.dependencies) {
                deps = Object.keys(packageJSON.dependencies);
                deps.forEach(install);
            }
        }

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
            path,
            data: new Uint8Array(file.buffer)
        });

        installingPackage.progress.setStatus(
            `(${i}/${files.length}) unpacking`
        );
        installingPackage.progress.setProgress(i, files.length);
    }

    // maybe leftovers
    if (filesToWrite.length) {
        await writeFiles();
    }

    installingPackage.progress.setProgress(1, 1);
    installingPackage.progress.setStatus("installed");

    installingPackages.delete(name);

    return deps;
}
