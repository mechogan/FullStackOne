import { Store } from "../store";
import { BuildError } from "../store/editor";

export function Packages() {
    Store.editor.codeEditor.buildErrors.subscribe(checkForPackageToInstall);
}

function checkForPackageToInstall(buildErrors: BuildError[]){
    const packageToInstall = new Set<string>();
    buildErrors.forEach(({message}) => {
        if (message.startsWith("Could not resolve")) {
            const packageName: string = message
                .match(/\".*\"/)
                ?.at(0)
                ?.slice(1, -1);
    
            if (packageName.startsWith(".") || !packageName) return;

            packageToInstall.add(parsePackageName(packageName))
        }
    });

    
}

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