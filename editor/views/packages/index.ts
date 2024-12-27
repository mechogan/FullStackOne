import packages from "../../lib/packages";
import { Store } from "../../store";
import { BuildError } from "../../store/editor";
import { PackagesInstallProgress } from "./progress";

export function Packages() {
    Store.editor.codeEditor.buildErrors.subscribe(checkForPackageToInstall);
    Store.packages.installingPackages.subscribe(PackagesInstallProgress);
}

function checkForPackageToInstall(buildErrors: BuildError[]) {
    buildErrors.forEach(({ message }) => {
        if (!message.startsWith("Could not resolve")) return;

        const packageName: string = message
            .match(/\".*\"/)
            ?.at(0)
            ?.slice(1, -1);

        if (packageName.startsWith(".") || !packageName) return;

        packages.install(packageName);
    });
}
