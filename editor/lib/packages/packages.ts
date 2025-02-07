import { bridge } from "../../../lib/bridge";
import { getLowestKeyIdAvailable, serializeArgs } from "../../../lib/bridge/serialization";
import core_message from "../../../lib/core_message";
import { Project } from "../../types";

const activeInstallations = new Map<
    number,
    {
        project: Project,
        installing: Map<string, PackageInfoProgress>
        progress?: InstallationProgressCb,
        resolve: (result: InstallationResult) => void
    }
>();

type InstallationResult = {
    duration: number,
    packagesInstalledCount: number
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

        activeInstallation.progress?.(arr);
        return
    }

    const installation = message as {
        id: number,
    } & InstallationResult;

    activeInstallation.resolve(installation);
    activeInstallations.delete(message.id);
}

// 60 and 61
export function install(
    project: Project,
    packagesNames: string[],
    progress?: InstallationProgressCb,
    quick = false
) {
    if (!addedListener) {
        core_message.addListener("packages-installation", installationsListener)
        addedListener = true;
    }

    const installationId = getLowestKeyIdAvailable(activeInstallations);

    const method = quick ? 61 : 60
    let args = [project.id, installationId]

    if (!quick) {
        args = args.concat(packagesNames)
    }

    const payload = new Uint8Array([
        method,
        ...serializeArgs(args)
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