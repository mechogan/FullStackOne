import api from "../../../api";
import { Loader } from "../../../components/loader";
import { InputFile } from "../../../components/primitives/inputs";
import { TopBar } from "../../../components/top-bar";
import { ViewScrollable } from "../../../components/view-scrollable";
import stackNavigation from "../../../stack-navigation";

type ImportZipOpts = {
    didImportProject: () => void;
};

export function ImportZip(opts: ImportZipOpts) {
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

    zipFileInput.input.onchange = () => {
        const file = zipFileInput.input.files?.[0];
        if (!file) return;

        zipFileInput.input.disabled = true;

        const loader = CreateLoader({
            text: "Importing Project..."
        });

        const consoleTerminal = ConsoleTerminal();

        scrollable.append(loader, consoleTerminal.container);

        api.projects
            .importZIP(file, (message) => {
                consoleTerminal.text.innerText += `${message}\n`;
                consoleTerminal.text.scrollIntoView(false);
            })
            .then(opts.didImportProject);
    };

    scrollable.append(form);

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

    const text = document.createElement("pre");
    container.append(text);

    return { container, text };
}
