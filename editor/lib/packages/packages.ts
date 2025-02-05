import { bridge } from "../../../lib/bridge";
import { getLowestKeyIdAvailable, serializeArgs } from "../../../lib/bridge/serialization";
import core_message from "../../../lib/core_message";
import { Project } from "../../types";

const activeInstallations = new Map<
    number,
    {
        progress: InstallationProgressCb,
        resolve: (result: InstallationResult) => void
    }
>();

type InstallationResult = {
    duration: number,
    packages: PackageInfo[]
}

export type PackageInfo = {
    name: string,
    version: string,
    progress: {
        stage: string,
        loaded: number,
        total: number
    }
}

type InstallationProgressCb = (packages: PackageInfo[]) => void

let addedListener = false;

function installationsListener(messageStr: string) {
    const message = JSON.parse(messageStr) as {
        id: number,
        packages: PackageInfo[],
        duration: number
    };

    const activeInstallation = activeInstallations.get(message.id);

    if (!activeInstallation) {
        console.log("received pacakges installation notification for unknown active installation");
        return;
    }

    if (message.duration === 0) {
        activeInstallation.progress(message.packages);
        return
    }
        
    activeInstallation.resolve(message);
    activeInstallations.delete(message.id)
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
            progress,
            resolve
        });

        bridge(payload)
    })
}