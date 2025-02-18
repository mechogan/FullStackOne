import createTerminal, { Command } from "@fullstacked/terminal";
import { createElement } from "../../components/element";
import { Store } from "../../store";
import { npm } from "../../commands/npm";
import { Project } from "../../types";
import { Button } from "@fullstacked/ui";

const commands: Command[] = [
    ...npm,
    {
        name: "close",
        alias: ["exit"],
        exec: () => {
            (document.activeElement as HTMLElement).blur();
            Store.editor.setTerminalOpen(false);
        }
    }
];

export function Terminal(project: Project) {
    const container = createElement("div");
    container.classList.add("terminal-container");

    const { dispose } = createTerminal(container, commands, project);

    const toggleTerminal = (open: boolean) => {
        if (open) {
            container.classList.add("open");
            container.querySelector("textarea").focus();
            setTimeout(() => {
                container.querySelector(".xterm-scroll-area")?.scrollIntoView(false)
            }, 500)
        } else {
            container.classList.remove("open");
        }
    };

    Store.editor.terminalOpen.subscribe(toggleTerminal);
    container.ondestroy = () => {
        Store.editor.terminalOpen.unsubscribe(toggleTerminal);
        dispose();
    };

    const closeButton = Button({
        style: "icon-small",
        iconLeft: "Arrow"
    });

    container.append(closeButton);

    closeButton.onclick = () => {
        Store.editor.setTerminalOpen(false);
    };

    return container;
}
