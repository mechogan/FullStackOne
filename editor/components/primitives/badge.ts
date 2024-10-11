/* 
This file must follow the figma design
https://www.figma.com/design/xb3JBRCvEWpbwGda03T5QQ/Mockups?node-id=101-1212
*/

type BadgeOpts = {
    text: string;
    type: "success" | "warning" | "error" | "info" | "info-2";
};

export function Badge(opts?: Partial<BadgeOpts>) {
    const container = document.createElement("label");
    container.classList.add("badge");

    if (opts?.type) {
        container.classList.add(opts.type);
    }

    container.innerText = opts?.text || "";

    return container;
}
