import slugify from "slugify";
import api from "../../api";
import { Button } from "../../components/primitives/button";
import { InputText } from "../../components/primitives/inputs";
import { TopBar } from "../../components/top-bar";

type CreateEmptyOpts = {
    didCreateProject: () => void;
};

export function CreateEmpty(opts: CreateEmptyOpts) {
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

        const id = slugify(inputIdentifier.input.value, {
            lower: true
        });

        api.projects
            .create({
                title: inputTitle.input.value,
                id,
                location: id
            })
            .then(opts.didCreateProject);
    };

    form.append(inputTitle.container, inputIdentifier.container, createButton);

    container.append(form);

    setTimeout(() => inputTitle.input.focus(), 1);

    return container;
}
