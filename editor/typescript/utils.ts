export function parseModuleName(moduleName: string): {
    name: string;
    path: string;
} {
    const packageNameComponents = moduleName.split("/");
    // @some/package
    if (packageNameComponents.at(0).startsWith("@")) {
        return {
            name: packageNameComponents.slice(0, 2).join("/"),
            path: packageNameComponents.slice(2).join("/")
        };
    }
    // react-dom/client
    return {
        name: packageNameComponents.at(0),
        path: packageNameComponents.slice(1).join("/")
    };
}
