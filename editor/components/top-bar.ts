import stackNavigation from "../stack-navigation";
import { Button } from "./primitives/button";

type TopBarOpts = {
    noBack: boolean;
    title: string;
    actions: HTMLElement[];
};

export function TopBar(opts?: Partial<TopBarOpts>) {
    const container = document.createElement("div");
    container.classList.add("top-bar");

    const left = document.createElement("div");

    if (!opts?.noBack) {
        const backButton = Button({
            style: "icon-large",
            iconLeft: "Arrow"
        });

        backButton.onclick = () => stackNavigation.back();

        left.append(backButton);
    } else {
        container.classList.add("no-back");
    }

    if (opts?.title) {
        const title = document.createElement("h1");
        title.innerText = opts.title;
        left.append(title);
    }

    const right = document.createElement("div");

    if (opts?.actions) {
        right.append(...opts.actions);
    }

    container.append(left, right);

    return container;
}
