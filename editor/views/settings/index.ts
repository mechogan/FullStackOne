import { Button } from "../../components/primitives/button";
import { TopBar } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";
import stackNavigation from "../../stack-navigation";
import {
    BG_COLOR,
    PACKAGES_BUTTON_ID,
    SETTINGS_VIEW_ID
} from "../../constants";
import { createRefresheable } from "../../components/refresheable";
import { Project } from "../project";
import { Version } from "./version";
import { GitAuthentications } from "./git-authentications";
import fs from "../../../lib/fs";
import { InputSwitch } from "../../components/primitives/inputs";
import { createElement } from "../../components/element";
import { Store } from "../../store";

export function Settings() {
    const { container, scrollable } = ViewScrollable();
    container.id = SETTINGS_VIEW_ID;
    container.classList.add("view");

    const topBar = TopBar({
        title: "Settings"
    });

    container.prepend(topBar);

    const userMode = UserMode();

    scrollable.append(
        userMode, 
        Packages(), 
        GitAuthentications(), 
        Version(),
    );

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: userMode.destroy
    });
}

function UserMode() {
    const container = createElement("div");
    container.classList.add("user-mode");

    const top = document.createElement("div");
    top.innerHTML = `<h2>User Mode</h2>`;

    const inputSwitch = InputSwitch();
    top.append(inputSwitch.container);

    const p = document.createElement("p");
    p.innerText = `Simpler interface, removes all developer-related elements.
Projects start faster, builds only when needed.`

    container.append(top, p);

    const cb = (userMode: boolean) => {
        inputSwitch.input.checked = userMode
    }
    Store.preferences.isUserMode.subscribe(cb);
    container.ondestroy = () => {
        Store.preferences.isUserMode.unsubscribe(cb);
    }
    inputSwitch.input.onchange = () => {
        Store.preferences.setUserMode(inputSwitch.input.checked);
    }

    return container;
}

let refreshPackageButton: ReturnType<typeof createRefresheable>["refresh"];
function Packages() {
    const packages = document.createElement("div");
    packages.classList.add("packages");

    packages.innerHTML = `
        <h2>Packages</h2>
    `;
    const packageButton = createRefresheable(PackagesButton);
    packages.append(packageButton.element);
    refreshPackageButton = packageButton.refresh;
    packageButton.refresh();

    return packages;
}

async function PackagesButton() {
    const packagesCount = (await fs.readdir("node_modules")).length;
    const text = packagesCount + " package" + (packagesCount > 1 ? "s" : "");
    const button = Button({
        text,
        iconLeft: "Package"
    });
    button.onclick = () => {
        const view = Project({
            id: "node_modules",
            title: "Packages",
            createdDate: null
        });
        view.ondestroy = refreshPackageButton;
    };
    button.id = PACKAGES_BUTTON_ID;

    return button;
}
