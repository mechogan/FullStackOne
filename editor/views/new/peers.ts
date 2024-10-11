import { Button } from "../../components/primitives/button";
import { TopBar } from "../../components/top-bar";

export function Peers() {
    const container = document.createElement("div");
    container.classList.add("view");

    const connectionButton = Button({
        style: "icon-large",
        iconLeft: "Link"
    });

    const topBar = TopBar({
        title: "Peers",
        actions: [connectionButton]
    });

    container.append(topBar);

    return container;
}
