import rpc from "../rpc";
import { Dialog } from "../components/dialog";
import { PackagesInstallProgress } from "./progress";
import type { PackageInstallerWorkerMessage } from "./worker";
import { fromByteArray } from "base64-js";

let nodeModulesDirectory: string;

const concurrentInstallation = 10;

type ActiveWorker = {
    worker: Worker;
    ready: boolean;
    installing: string;
};
const workers = new Set<ActiveWorker>();

let packagesDirectory: string;
let progressView: {
    remove: () => void;
    addPackage: ReturnType<typeof PackagesInstallProgress>["addPackage"];
};

const packagesToInstallOrder: string[] = [];
const packagesToInstall = new Map<
    string,
    {
        promise?: Promise<void>;
        progress?: ReturnType<
            ReturnType<typeof PackagesInstallProgress>["addPackage"]
        >;
        promiseResolve?: () => void;
        promiseReject?: () => void;
        onmessage?: (message: PackageInstallerWorkerMessage) => void;
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
    let packageToInstall = packagesToInstall.get(name);

    if (!packageToInstall) {
        if (!progressView) {
            renderProgressDialog();
        }

        const progress = progressView.addPackage(name);
        progress.setStatus("waiting");
        const promise = new Promise<void>((promiseResolve, promiseReject) => {
            packageToInstall = {
                ...(packageToInstall || {}),
                promiseResolve,
                promiseReject
            };
        });
        packageToInstall = {
            ...(packageToInstall || {}),
            promise,
            progress
        };

        packagesToInstall.set(name, packageToInstall);
        packagesToInstallOrder.push(name);
    }

    installLoop();

    return packageToInstall.promise;
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

let platform: Awaited<ReturnType<ReturnType<typeof rpc>["platform"]>>;
async function createWorker() {
    if (!platform) {
        platform = await rpc().platform();
    }

    const activeWorker: ActiveWorker = {
        worker: new Worker("worker-package-install.js", { type: "module" }),
        ready: false,
        installing: null
    };
    workers.add(activeWorker);
    return new Promise<void>((resolve) => {
        activeWorker.worker.onmessage = (message) => {
            const msg: PackageInstallerWorkerMessage = message.data;
            if (msg.type === "ready") {
                if (platform === "android") {
                    activeWorker.worker.postMessage({ platform });
                } else {
                    activeWorker.ready = true;
                    resolve();
                }
            } else if (msg.type === "ready-android") {
                activeWorker.ready = true;
                resolve();
            } else if (msg.type === "body-android") {
                const { id, body } = msg;
                globalThis.Android.passRequestBody(id, fromByteArray(body));
                activeWorker.worker.postMessage({ request_id: id });
            } else {
                packagesToInstall.get(msg.name).onmessage(msg);
            }
        };
    });
}

function installLoop() {
    if (packagesToInstall.size === 0) {
        if (
            Array.from(workers).every(
                (activeWorker) => !activeWorker.installing
            )
        ) {
            progressView?.remove();
            for (const { worker } of workers) {
                worker.terminate();
            }
            workers.clear();
        }
        return;
    }

    if (packagesToInstallOrder.length === 0) {
        return;
    }

    let worker: ActiveWorker;
    for (const activeWorker of workers) {
        if (!activeWorker.installing && activeWorker.ready) {
            worker = activeWorker;
            break;
        }
    }

    if (!worker) {
        if (workers.size < concurrentInstallation) {
            createWorker().then(installLoop);
        }
        return;
    }

    const packageName = packagesToInstallOrder.shift();
    worker.installing = packageName;
    const installingPackage = packagesToInstall.get(packageName);

    let installed = false,
        dependenciesInstalled = true;

    const onCompleted = (success: boolean) => {
        if (installed) {
            packagesToInstall.delete(packageName);
            worker.installing = null;

            if (dependenciesInstalled) {
                if (success) installingPackage.promiseResolve();
                else installingPackage.promiseReject();
            }
        }

        installLoop();
    };

    installingPackage.onmessage = (message) => {
        if (message.type === "progress") {
            installingPackage.progress.setStatus(message.status);
            if (message.loaded !== undefined && message.total !== undefined) {
                installingPackage.progress.setProgress(
                    message.loaded,
                    message.total
                );
            }
        } else if (message.type === "dependencies" && message.packages.length) {
            dependenciesInstalled = false;
            Promise.all(message.packages.map(install))
                .then(() => {
                    dependenciesInstalled = true;
                    onCompleted(true);
                })
                .catch(() => {
                    dependenciesInstalled = true;
                    onCompleted(false);
                });
        } else if (message.type === "done") {
            installed = true;
            onCompleted(message.success);
        }
    };

    worker.worker.postMessage(packageName);
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
