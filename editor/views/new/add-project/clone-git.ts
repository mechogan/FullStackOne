import { TopBar } from "../../../components/top-bar";

export function CloneGit() {
    const container = document.createElement("div");
    container.classList.add("view");

    const topBar = TopBar({
        title: "Clone git repository"
    });

    container.append(topBar);

    

    return container;
}