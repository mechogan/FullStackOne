import "xterm/css/xterm.css";
import { Terminal } from "xterm";

export class Console {
    render() {
        const container = document.createElement("div");

        // const ws = new WebSocket("ws://" + window.location.host);
        const term = new Terminal();
        term.open(container);
        // ws.onmessage = message => term.write(message.data)
        
        return container;
    }
}