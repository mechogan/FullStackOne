import type { Project as ProjectType } from "../../../api/config/types";
import { Button } from "../../../components/primitives/button";
import { TopBar } from "../../../components/top-bar";
import { Editor } from "./editor";
import { FileTree } from "./file-tree";

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
        actions: [gitButton, tsButton, runButton],
        onBack: () => {
            if (content.classList.contains("closed-panel")) {
                content.classList.remove("closed-panel");
                return false;
            }

            return true;
        }
    });

    container.append(topBar);

    const content = document.createElement("div");
    content.classList.add("content");

    content.append(
        FileTree({
            directory: project.location,
            onClosePanel: () => {
                content.classList.add("closed-panel");
            }
        }),
        Editor()
    );
    container.append(content);

    return container;
}
