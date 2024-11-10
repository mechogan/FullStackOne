import api from "../../api";
import rpc from "../../rpc";
import { Button } from "../../components/primitives/button";
import { TopBar } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";
import { Project } from "../project";
import { Connectivity } from "./connectivity";
import { GitAuthentications } from "./git-authentications";
import { Version } from "./version";
import stackNavigation from "../../stack-navigation";
import {
    BG_COLOR,
    PACKAGES_BUTTON_ID,
    SETTINGS_VIEW_ID
} from "../../constants";

export function Settings() {
    const { container, scrollable } = ViewScrollable();
    container.id = SETTINGS_VIEW_ID;
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

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR
    });
}

function Packages() {
    const packages = document.createElement("div");
    packages.classList.add("packages");

    packages.innerHTML = `
        <h2>Packages</h2>
    `;

    let button: ReturnType<typeof Button>, nodeModulesDirectory: string;
    const reloadButton = () => {
        api.packages.count().then(async (packagesCount) => {
            const text =
                packagesCount + " package" + (packagesCount > 1 ? "s" : "");

            const updatedButton = Button({
                text,
                iconRight: "Package"
            });
            updatedButton.id = PACKAGES_BUTTON_ID;

            if (!nodeModulesDirectory)
                nodeModulesDirectory =
                    await rpc().directories.nodeModulesDirectory();

            updatedButton.onclick = () => {
                stackNavigation.navigate(
                    Project({
                        project: {
                            title: "Packages",
                            id: "packages",
                            location: nodeModulesDirectory,
                            createdDate: null
                        },
                        didDeleteAllPackages: () => {
                            stackNavigation.back();
                            reloadButton();
                        },
                        didUpdateProject: null
                    }),
                    BG_COLOR
                );
            };

            if (button) {
                button.replaceWith(updatedButton);
            } else {
                packages.append(updatedButton);
            }

            button = updatedButton;
        });
    };
    reloadButton();

    return packages;
}
