import { Button } from "../../../components/primitives/button";
import { InputText } from "../../../components/primitives/inputs";
import { TopBar } from "../../../components/top-bar";

export function CreateEmpty() {
    const container = document.createElement("div");
    container.classList.add("view", "create-form");

    const topBar = TopBar({
        title: "Create empty project"
    });

    container.append(topBar);

    const form = document.createElement("form");

    const inputTitle = InputText({
        label: "Title"
    });
    const inputIdentifier = InputText({
        label: "Identifier"
    });

    const createButton = Button({
        text: "Create"
    });

    form.onsubmit = (e) => {
        e.preventDefault();
    };

    form.append(inputTitle.container, inputIdentifier.container, createButton);

    container.append(form);

    setTimeout(() => inputTitle.input.focus(), 1);

    return container;
}
