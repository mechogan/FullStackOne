import { Loader } from "../../../components/loader";
import { InputFile } from "../../../components/primitives/inputs";
import { TopBar } from "../../../components/top-bar";
import { ViewScrollable } from "../../../components/view-scrollable";

export function ImportZip() {
    const { container, scrollable } = ViewScrollable();
    container.classList.add("view", "create-form");

    const topBar = TopBar({
        title: "Import zip"
    });

    container.prepend(topBar);

    const form = document.createElement("form");

    const zipFileInput = InputFile({
        label: "Project ZIP"
    });

    form.append(zipFileInput.container);

    const loader = CreateLoader({
        text: "Importing Project..."
    });

    const consoleTerminal = ConsoleTerminal();

    scrollable.append(form, loader, consoleTerminal.container);

    consoleTerminal.text.innerText += "Verbose progress...";

    return container;
}

export function CreateLoader(opts: { text: string }) {
    const container = document.createElement("div");
    container.classList.add("create-loader");

    const text = document.createElement("div");
    text.innerText = opts.text;

    container.append(Loader(), text);

    return container;
}

export function ConsoleTerminal() {
    const container = document.createElement("div");
    container.classList.add("create-terminal");

    const text = document.createElement("div");
    container.append(text);

    return { container, text };
}
