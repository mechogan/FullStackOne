import core_message from "../../../lib/core_message";
import { Store } from "../../store";
import { PackagesInstallProgress } from "./progress";

export function Packages() {
    core_message.addListener("package", (dataStr) => {
        const packageInfo = JSON.parse(dataStr);
        console.log(packageInfo)
    });


    Store.packages.installingPackages.subscribe(PackagesInstallProgress);
}
