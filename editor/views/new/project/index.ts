import type { Project as ProjectType } from "../../../api/config/types";
import { Button } from "../../../components/primitives/button";
import { TopBar } from "../../../components/top-bar";

export function Project(project: ProjectType) {
    const container = document.createElement("div");
    container.id = "project";
    container.classList.add("view");

    const gitButton = Button({
        style: "icon-large",
        iconLeft: "Git"
    });

    const tsButton = Button({
        style: "icon-large",
        iconLeft: "TypeScript"
    });

    const runButton = Button({
        style: "icon-large",
        iconLeft: "Play"
    });

    const topBar = TopBar({
        title: project.title,
        subtitle: project.id,
        actions: [gitButton, tsButton, runButton]
    });

    container.prepend(topBar);

    return container;
}
