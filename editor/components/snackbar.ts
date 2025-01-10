/* 
This file must follow the figma design
https://www.figma.com/design/xb3JBRCvEWpbwGda03T5QQ/Mockups?node-id=415-3655
*/

import { Button } from "./primitives/button"

type SnackBarOpt = {
    message: string,
    button?: ReturnType<typeof Button>
}

let snackBarsContainer: HTMLDivElement;
const activeSnackBars = []

export function SnackBar(opts: SnackBarOpt) {
    if(!snackBarsContainer) {
        snackBarsContainer = document.createElement("div");
        snackBarsContainer.classList.add("snack-bars-container")
        document.body.append(snackBarsContainer);
    }

    const container = document.createElement("div");
    container.classList.add("snack-bar");

    const text = document.createElement("div");
    text.innerHTML = opts.message;
    container.append(text);

    if (opts.button) {
        container.append(opts.button);
    }

   snackBarsContainer.append(container);

    let timeout: ReturnType<typeof setTimeout>
    const dismiss = () => {
        clearTimeout(timeout);

        const animDuration = 500;
        container.style.transition = `${animDuration}ms opacity`;
        container.style.opacity = "0";
        setTimeout(() => container.remove(), animDuration)
    }

    // setTimeout(dismiss, 4000);

    return { dismiss }
}