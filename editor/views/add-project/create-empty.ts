import slugify from "slugify";
import { Button } from "../../components/primitives/button";
import { InputText } from "../../components/primitives/inputs";
import { TopBar } from "../../components/top-bar";
import { Store } from "../../store";
import stackNavigation from "../../stack-navigation";
import { BG_COLOR } from "../../constants";
import fs from "../../../lib/fs";

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

    inputTitle.input.onblur = () => {
        if (!inputIdentifier.input.value) {
            inputIdentifier.input.value = slugify(inputTitle.input.value, {
                lower: true
            });
        }
    };

    const createButton = Button({
        text: "Create"
    });

    form.onsubmit = (e) => {
        e.preventDefault();
        createButton.disabled = true;

        let id = inputIdentifier.input.value
            ? slugify(inputIdentifier.input.value, { lower: true })
            : slugify(inputTitle.input.value, { lower: true });
        id = id || "no-identifier";

        const title = inputTitle.input.value || "Empty Project";

        Promise.all([fs.mkdir(id), Store.projects.create({ title, id })]).then(
            () => stackNavigation.back()
        );
    };

    form.append(inputTitle.container, inputIdentifier.container, createButton);

    container.append(form);

    setTimeout(() => inputTitle.input.focus(), 1);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR
    });
}
