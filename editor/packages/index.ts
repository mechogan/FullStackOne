import packages from "../lib/packages";
import { Store } from "../store";
import { BuildError } from "../store/editor";

let ignoredPackages = new Set<string>();
export function Packages() {
    Store.packages.ignored.subscribe((ignored) => (ignoredPackages = ignored));
    Store.editor.codeEditor.buildErrors.subscribe(checkForPackageToInstall);
}

function getPackageNameFromBuildError(error: BuildError) {
    if (!error.message?.startsWith("Could not resolve")) return null;

    try {
        return error.message
            .match(/\".*\"/)
            ?.at(0)
            ?.slice(1, -1);
    } catch (e) {
        return null
    }
}

export function isModuleResolveError(error: BuildError) {
    const packageName = getPackageNameFromBuildError(error);
    return packageName && !packageName.startsWith(".") && !ignoredPackages.has(packageName);
}

function checkForPackageToInstall(buildErrors: BuildError[]) {
    buildErrors
        .forEach(e => {
            const packageName = getPackageNameFromBuildError(e)
            if (packageName)
                packages.install(packageName);
        });
}
