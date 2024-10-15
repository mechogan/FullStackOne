import stackNavigation from "../stack-navigation";
import { Button } from "./primitives/button";

type TopBarOpts = {
    noBack: boolean;
    title: string;
    subtitle: string;
    actions: HTMLElement[];
    onBack: () => boolean;
};

let h1Height: number, getH1HeightInterval: ReturnType<typeof setInterval>;

export function TopBar(opts?: Partial<TopBarOpts>) {
    const container = document.createElement("div");
    container.classList.add("top-bar");

    const left = document.createElement("div");

    let backButton: HTMLButtonElement;
    if (!opts?.noBack) {
        backButton = Button({
            style: "icon-large",
            iconLeft: "Arrow"
        });
        backButton.onclick = () => {
            if (opts?.onBack && !opts.onBack()) {
                return;
            }

            stackNavigation.back();
        };
        left.append(backButton);
    } else {
        container.classList.add("no-back");
    }

    const titlesContainer = document.createElement("div");
    titlesContainer.classList.add("titles");
    left.append(titlesContainer);

    let title: HTMLHeadingElement;
    if (opts?.title) {
        title = document.createElement("h1");
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

    const setHeight = () => {
        if (!h1Height) {
            const getH1Height = () => {
                if (h1Height) {
                    clearInterval(getH1HeightInterval);
                    getH1HeightInterval = null;
                    return;
                }

                h1Height = title.getBoundingClientRect().height;
                setHeight();
            };
            getH1HeightInterval = setInterval(getH1Height, 1000);
        } else {
            if (backButton) {
                backButton.style.height = h1Height + "px";
            }

            titlesContainer.style.minHeight = h1Height + "px";
        }
    };
    setHeight();

    return container;
}
