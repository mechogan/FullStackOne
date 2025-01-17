import { Store } from "../../store";
import { PackagesInstallProgress } from "./progress";

export function Packages() {
    Store.packages.installingPackages.subscribe(PackagesInstallProgress);
}
