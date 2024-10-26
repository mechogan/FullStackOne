import { Icon } from "./primitives/icon";

export function Loader() {
    const container = document.createElement("div");
    container.classList.add("loader");

    const dummy = document.createElement("div");
    container.append(dummy);

    const icon = Icon("Loader");
    container.append(icon);

    return container;
}
