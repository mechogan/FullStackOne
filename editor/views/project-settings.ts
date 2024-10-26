import api from "../api";
import rpc from "../rpc";
import { CONFIG_TYPE, Project } from "../api/config/types";
import { Button } from "../components/primitives/button";
import { InputText } from "../components/primitives/inputs";
import { TopBar } from "../components/top-bar";
import { ViewScrollable } from "../components/view-scrollable";
import slugify from "slugify";

type ProjectSettingsOpts = {
    project: Project;
    didUpdateProject: () => void;
};

export function ProjectSettings(opts: ProjectSettingsOpts) {
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
    titleInput.input.value = opts.project.title;
    const identifierInput = InputText({
        label: "Identifier"
    });
    identifierInput.input.value = opts.project.id;
    identifierInput.input.onblur = () => {
        identifierInput.input.value = slugify(identifierInput.input.value, {
            lower: true
        });
    };

    const updateButton = Button({
        text: "Update"
    });

    form.append(titleInput.container, identifierInput.container, updateButton);

    form.onsubmit = async (e) => {
        e.preventDefault();

        updateButton.disabled = true;
        identifierInput.input.value = slugify(identifierInput.input.value, {
            lower: true
        });

        const updatedTitle = titleInput.input.value;
        const updatedIdentifier = identifierInput.input.value;

        if (
            updatedTitle === opts.project.title &&
            updatedIdentifier === opts.project.id
        )
            return opts.didUpdateProject();

        const projects = await api.projects.list();
        const indexOf = projects.findIndex(({ id }) => id === opts.project.id);
        const project = projects[indexOf];

        project.title = updatedTitle;

        if (updatedIdentifier !== project.id) {
            project.id = updatedIdentifier;
            await rpc().fs.rename(opts.project.location, updatedIdentifier, {
                absolutePath: true
            });
            project.location = updatedIdentifier;
        }

        projects[indexOf] = project;
        await api.config.save(CONFIG_TYPE.PROJECTS, projects);
        opts.didUpdateProject();
    };

    scrollable.append(form);

    return container;
}
