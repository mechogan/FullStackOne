import { TopBar } from "../../../components/top-bar";

export function ImportZip() {
    const container = document.createElement("div");
    container.classList.add("view");

    const topBar = TopBar({
        title: "Import zip"
    });

    container.append(topBar);

    

    return container;
}