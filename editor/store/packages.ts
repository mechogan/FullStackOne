import { createSubscribable } from ".";
import core_message from "../../lib/core_message";

export type Progress = {
    Version: string,
    Stage: "downloading" | "unpacking" | "done" | "error";
    Loaded: number;
    Total: number;
};

const activePackageInstall = new Map<string, Progress>();
const installingPackages = createSubscribable(() => activePackageInstall);

const ignoredPackages = new Set<string>();
const ignored = createSubscribable(() => ignoredPackages);

export const packages = {
    installingPackages: installingPackages.subscription,
    ignored: ignored.subscription
};

core_message.addListener("package-install-progress", (dataStr) => {
    const { Name, ...progress } = JSON.parse(dataStr);
    activePackageInstall.set(Name, progress);

    let allDone = true;
    for (const progress of activePackageInstall.values()) {
        if (progress.Stage === "error") {
            console.log("ignore", Name);
            ignoredPackages.add(Name);
            ignored.notify();
        } else if (progress.Stage !== "done") {
            allDone = false;
        }
    }
    if (allDone) {
        activePackageInstall.clear();
    }

    installingPackages.notify();
});
