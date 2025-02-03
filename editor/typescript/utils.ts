export function parsePackageName(packageName: string): {
    name: string;
    version: string;
    path: string;
} {
    const packageNameComponents = packageName.split("/");
    // @some/package
    if (packageNameComponents.at(0).startsWith("@")) {
        const name = packageNameComponents.slice(0, 2).join("/");
        const version =
            packageNameComponents.length > 2 &&
            packageNameComponents.at(2).match(/\d+\.\d+\.\d+/)
                ? packageNameComponents.at(2)
                : null;
        const path =
            version === null
                ? packageNameComponents.slice(2).join("/")
                : packageNameComponents.slice(3).join("/");

        return {
            name,
            version,
            path
        };
    }
    // react-dom/client
    const name = packageNameComponents.at(0);
    const version =
        packageNameComponents.length > 1 &&
        packageNameComponents.at(1).match(/\d+\.\d+\.\d+/)
            ? packageNameComponents.at(1)
            : null;
    const path =
        version === null
            ? packageNameComponents.slice(1).join("/")
            : packageNameComponents.slice(2).join("/");

    return {
        name,
        version,
        path
    };
}
