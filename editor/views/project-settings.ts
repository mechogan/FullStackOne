import { Button } from "../components/primitives/button";
import { InputText } from "../components/primitives/inputs";
import { TopBar } from "../components/top-bar";
import { ViewScrollable } from "../components/view-scrollable";
import slugify from "slugify";
import stackNavigation from "../stack-navigation";
import { BG_COLOR } from "../constants";
import { Project } from "../types";
import { Store } from "../store";

export function ProjectSettings(project: Project) {
    const { container, scrollable } = ViewScrollable();
    container.classList.add("project-settings");

    container.prepend(
        TopBar({
            title: "Project Settings"
        })
    );

    const form = document.createElement("form");

    const titleInput = InputText({
        label: "Title"
    });
    titleInput.input.value = project.title;
    const identifierInput = InputText({
        label: "Identifier"
    });
    identifierInput.input.value = project.id;
    identifierInput.input.onblur = () => {
        identifierInput.input.value = slugify(identifierInput.input.value, {
            lower: true
        });
    };

    const updateButton = Button({
        text: "Update"
    });

    form.append(titleInput.container, identifierInput.container, updateButton);

    form.onsubmit = (e) => {
        e.preventDefault();

        updateButton.disabled = true;
        identifierInput.input.value = slugify(identifierInput.input.value, {
            lower: true
        });

        const updatedProject = {
            ...project
        }

        updatedProject.title = titleInput.input.value;
        updatedProject.id = identifierInput.input.value;

        if (
            updatedProject.title === project.title &&
            updatedProject.id === project.id
        ) {
            stackNavigation.back();
            return;
        }

        Store.projects.update(project, updatedProject)
            .then(() => stackNavigation.back())
    };

    scrollable.append(form);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR
    })
}
