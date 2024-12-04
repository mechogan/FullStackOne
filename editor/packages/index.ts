import packages from "../lib/packages";
import { Store } from "../store";
import { BuildError } from "../store/editor";

let ignoredPackages = new Set<string>();
export function Packages() {
    Store.packages.ignored.subscribe((ignored) => ignoredPackages = ignored);
    Store.editor.codeEditor.buildErrors.subscribe(checkForPackageToInstall);
}

function checkForPackageToInstall(buildErrors: BuildError[]) {
    buildErrors.forEach(({ message }) => {
        if (!message.startsWith("Could not resolve")) return;

        const packageName: string = message
            .match(/\".*\"/)
            ?.at(0)
            ?.slice(1, -1);

        console.log("install", packageName);
        if (packageName.startsWith(".") || !packageName || ignoredPackages.has(packageName)) return;

        packages.install(packageName);
    });
}
