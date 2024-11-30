import { createSubscribable } from ".";
import core_message from "../../lib/core_message";

export type Progress = {
    Stage: "downloading" | "unpacking" | "done";
    Loaded: number;
    Total: number;
};

const activePackageInstall = new Map<string, Progress>();
const installingPackages = createSubscribable(() => activePackageInstall);

export const packages = {
    installingPackages: installingPackages.subscription
};

core_message.addListener("package-install-progress", (dataStr) => {
    const { Name, ...progress } = JSON.parse(dataStr);
    activePackageInstall.set(Name, progress);

    let allDone = true;
    for (const progress of activePackageInstall.values()) {
        if (progress.Stage !== "done") allDone = false;
    }
    if (allDone) {
        activePackageInstall.clear();
    }

    installingPackages.notify();
});
