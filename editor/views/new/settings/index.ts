import api from "../../../api";
import { Button } from "../../../components/primitives/button";
import { TopBar } from "../../../components/top-bar";
import { ViewScrollable } from "../../../components/view-scrollable";
import { Connectivity } from "./connectivity";
import { GitAuthentications } from "./git-authentications";
import { Version } from "./version";

export function Settings() {
    const { container, scrollable } = ViewScrollable();
    container.id = "settings";
    container.classList.add("view");

    const topBar = TopBar({
        title: "Settings"
    });

    container.prepend(topBar);

    scrollable.append(
        Packages(),
        Connectivity(),
        GitAuthentications(),
        Version()
    );

    return container;
}

function Packages() {
    const packages = document.createElement("div");
    packages.classList.add("packages");

    packages.innerHTML = `
        <h2>Packages</h2>
    `;

    api.packages.count().then((packagesCount) => {
        const text =
            packagesCount + " package" + (packagesCount > 1 ? "s" : "");

        const button = Button({
            text,
            iconRight: "Package"
        });

        packages.append(button);
    });

    return packages;
}
