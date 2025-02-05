import createTerminal, { Command } from "@fullstacked/terminal";
import { createElement } from "../../components/element";
import { Store } from "../../store";
import esbuild from "../../lib/esbuild";


const commands: Command[] = [
    {
        name: "close",
        alias: ["exit"],
        exec: () => {
            (document.activeElement as HTMLElement).blur()
            Store.editor.setTerminalOpen(false);
        }
    },{
        name: "npm",
        exec: () => {},
        subcommands: [{
            name: "install",
            alias: ["i"],
            exec: (args, it) => {
                args.forEach(p => esbuild.install(p))
            }
        }]
    }
]


export function Terminal() {
    const container = createElement("div");
    container.classList.add("terminal-container");

    const { dispose } = createTerminal(container, commands)

    const toggleTerminal = (open: boolean) => {
        if (open) {
            container.classList.add("open");
            container.querySelector("textarea").focus();
        } else {
            container.classList.remove("open")
        }
    }

    Store.editor.terminalOpen.subscribe(toggleTerminal)
    container.ondestroy = () => {
        Store.editor.terminalOpen.unsubscribe(toggleTerminal);
        dispose();
    }

    return container;
}