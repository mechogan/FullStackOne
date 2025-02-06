import { bridge } from "../../../lib/bridge";
import { getLowestKeyIdAvailable, serializeArgs } from "../../../lib/bridge/serialization";
import core_message from "../../../lib/core_message";
import fs from "../../../lib/fs";
import { Project } from "../../types";

const activeInstallations = new Map<
    number,
    {
        project: Project,
        installing: Map<string, PackageInfoProgress>
        progress: InstallationProgressCb,
        resolve: (result: InstallationResult) => void
    }
>();

type InstallationResult = {
    duration: number,
    packages: PackageInfo[]
}

type PackageInfoProgress = {
    stage: string,
    loaded: number,
    total: number
}

export type PackageInfo = {
    name: string,
    version: string,
    direct: boolean,
    dependencies: PackageInfo[]
    progress: PackageInfoProgress
}

type InstallationProgressCb = (packages: [string, PackageInfoProgress][]) => void

let addedListener = false;

function installationsListener(messageStr: string) {
    const message = JSON.parse(messageStr) as { id: number };

    const activeInstallation = activeInstallations.get(message.id);

    if (!activeInstallation) {
        console.log("received packages installation notification for unknown active installation");
        return;
    }

    if (typeof message["duration"] === 'undefined') {
        const { name, version, progress } = message as { id: number } & PackageInfo;

        const packageName = name + "@" + version;

        if (progress.stage === "done") {
            activeInstallation.installing.delete(packageName)
        } else {
            activeInstallation.installing.set(packageName, progress)
        }

        const arr = Array.from(activeInstallation.installing)
            .sort((a, b) => a[0] < b[0] ? -1 : 1)

        activeInstallation.progress(arr);
        return
    }

    const installation = message as {
        id: number,
        packages: PackageInfo[],
        duration: number
    }
    activeInstallation.resolve(installation);
    activeInstallations.delete(message.id);

    updatePackageJSON(activeInstallation.project, installation.packages);
}

// 60
export function install(
    project: Project,
    packagesNames: string[],
    progress: InstallationProgressCb
) {
    if (!addedListener) {
        core_message.addListener("packages-installation", installationsListener)
        addedListener = true;
    }

    const installationId = getLowestKeyIdAvailable(activeInstallations);

    const payload = new Uint8Array([
        60,
        ...serializeArgs([project.id, installationId, ...packagesNames])
    ]);

    return new Promise<InstallationResult>(resolve => {
        activeInstallations.set(installationId, {
            project,
            progress,
            resolve,
            installing: new Map()
        });

        bridge(payload)
    })
}


// sort json keys alphabetically
// source: https://gist.github.com/davidfurlong/463a83a33b70a3b6618e97ec9679e490
const replacer = (key, value) =>
    value instanceof Object && !(value instanceof Array) ?
        Object.keys(value)
            .sort()
            .reduce((sorted, key) => {
                sorted[key] = value[key];
                return sorted
            }, {}) :
        value;

async function updatePackageJSON(project: Project, packages: PackageInfo[]) {
    const packageJsonPath = project.id + "/package.json";
    const lockJsonPath = project.id + "/lock.json";
    const exists = await fs.exists(packageJsonPath);
    const packageJson = exists?.isFile
        ? JSON.parse(await fs.readFile(packageJsonPath, { encoding: "utf8" }))
        : {}

    if (!packageJson["dependencies"]) {
        packageJson["dependencies"] = {}
    }

    const lock = {
        packages: {}
    }

    packages.forEach(p => {
        if (p.direct) {
            packageJson["dependencies"][p.name] = "^" + p.version
        }

        lock.packages[p.name] = {
            version: p.version
        };

        // this should be recursive...
        if (p.dependencies?.length) {
            lock.packages[p.name].dependencies = {};
            p.dependencies.forEach(pp => {
                lock.packages[p.name].dependencies[pp.name] = {
                    version: pp.version
                }
            })
        }
    });

    fs.writeFile(packageJsonPath, JSON.stringify(packageJson, replacer, 4));
    fs.writeFile(lockJsonPath, JSON.stringify(lock, replacer, 4));
}