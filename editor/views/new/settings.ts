import api from "../../api";
import { Button } from "../../components/primitives/button";
import { InputSwitch, InputText } from "../../components/primitives/inputs";
import { TopBar } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";

export function Settings() {
    const { container, scrollable } = ViewScrollable();
    container.id = "settings";
    container.classList.add("view");

    const topBar = TopBar({
        title: "Settings"
    });

    container.prepend(topBar);

    scrollable.append(Packages(), Connectivity());

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

function Connectivity() {
    const container = document.createElement("div");
    container.classList.add("connectivity");

    container.innerHTML = `<h2>Connectivity</h2>`;

    const autoConnect = InputSwitch({
        label: "Connect automatically to nearby trusted peers"
    });

    const deviceName = InputText({
        label: "Device Name"
    });

    container.append(autoConnect.container, deviceName.container);

    return container;
}
