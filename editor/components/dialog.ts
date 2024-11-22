import stackNavigation from "../stack-navigation";
import { ElementComponent } from "./element";

export function Dialog(content: ElementComponent) {
    const container = document.createElement("div");
    container.classList.add("dialog");

    const overlay = document.createElement("div");
    overlay.classList.add("dialog-overlay");

    container.append(content);

    overlay.append(container);

    document.body.append(overlay);
    stackNavigation.lock = true;

    return {
        remove: () => {
            content?.destroy();
            stackNavigation.lock = false;
            overlay.remove();
        }
    };
}
