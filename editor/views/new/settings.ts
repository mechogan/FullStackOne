import { TopBar } from "../../components/top-bar";

export function Settings() {
    const container = document.createElement("div");
    container.classList.add("view");

    const topBar = TopBar({
        title: "Settings"
    });

    container.append(topBar)

    return container;
}