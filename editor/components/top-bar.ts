import stackNavigation from "../stack-navigation";
import { Button } from "./primitives/button";

type TopBarOpts = {
    noBack: boolean;
    title: string;
    subtitle: string;
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

    const titlesContainer = document.createElement("div");
    left.append(titlesContainer);

    if (opts?.title) {
        const title = document.createElement("h1");
        title.innerText = opts.title;
        titlesContainer.append(title);
    }
    if (opts?.subtitle) {
        const subtitle = document.createElement("p");
        subtitle.innerText = opts.subtitle;
        titlesContainer.append(subtitle);
    }

    const right = document.createElement("div");

    if (opts?.actions) {
        right.append(...opts.actions);
    }

    container.append(left, right);

    return container;
}
