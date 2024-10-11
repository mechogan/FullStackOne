/* 
This file must follow the figma design
https://www.figma.com/design/xb3JBRCvEWpbwGda03T5QQ/Mockups?node-id=6-67
*/

import { Icon } from "./icon";

type ButtonOpts = {
    iconLeft: string,
    iconRight: string,
    text: string,
    style: "default" | "text" | "icon-small" | "icon-large",
    color: "red"
}

export function Button(opts?: Partial<ButtonOpts>){
    const button = document.createElement("button");

    if(!opts?.style?.startsWith("icon")) {
        button.innerText = opts?.text || "";
    }

    if(opts?.style && opts?.style !== "default") {
        button.classList.add(opts.style);
    }

    if(opts?.color) {
        button.classList.add(opts.color)
    }

    if(opts?.iconLeft) {
        button.prepend(Icon(opts.iconLeft))
    }

    if(opts?.iconRight) {
        button.append(Icon(opts.iconRight))
    }

    return button;
}

export function ButtonGroup(buttons: ReturnType<typeof Button>[]){
    const container = document.createElement("div");
    container.classList.add("button-group");

    container.append(...buttons);

    return container;
}