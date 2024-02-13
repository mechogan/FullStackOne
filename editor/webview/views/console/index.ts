import "./index.css";
import "@xterm/xterm/css/xterm.css";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";

export class Console {
    private container = document.createElement("div");
    term = new Terminal();
    fitAddon = new FitAddon();

    constructor(){
        this.term.open(this.container);
        this.term.loadAddon(this.fitAddon);

        window.addEventListener("resize", () => this.fitAddon.fit());
        window.addEventListener("focus", () => setTimeout(() => this.fitAddon.fit(), 350));
    }

    render() {
        this.term.clear();
        this.container.classList.add("console-container");
        return this.container;
    }
}