import { Button } from "../../../components/primitives/button";
import { InputText } from "../../../components/primitives/inputs";
import { TopBar } from "../../../components/top-bar";
import { ViewScrollable } from "../../../components/view-scrollable";
import { ConsoleTerminal, CreateLoader } from "./import-zip";

export function CloneGit() {
    const { container, scrollable } = ViewScrollable();
    container.classList.add("view", "create-form");

    const topBar = TopBar({
        title: "Clone git repository"
    });

    container.prepend(topBar);

    const form = document.createElement("form");

    const repoUrlInput = InputText({
        label: "Git repository URL"
    });

    const cloneButton = Button({
        text: "Clone"
    });

    form.append(repoUrlInput.container, cloneButton);

    const loader = CreateLoader({
        text: "Cloning from remote..."
    });

    const consoleTerminal = ConsoleTerminal();

    scrollable.append(form, loader, consoleTerminal.container);

    consoleTerminal.text.innerText = "Verbose progress...";

    return container;
}
