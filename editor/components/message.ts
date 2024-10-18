import { Icon } from "./primitives/icon";

type MessageOpts = {
    text: string;
    style: "warning";
};

export function Message(opts: Partial<MessageOpts>) {
    const container = document.createElement("div");
    container.classList.add("message");

    if (opts.style) {
        container.classList.add(opts.style);
    }

    const iconName = opts.style === "warning" ? "Warning" : "Info";

    const icon = Icon(iconName);

    const text = document.createElement("b");
    text.innerText = opts.text;

    container.append(icon, text);

    return container;
}
