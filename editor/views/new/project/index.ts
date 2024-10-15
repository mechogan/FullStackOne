import type { Project as ProjectType } from "../../../api/config/types";
import { Button } from "../../../components/primitives/button";
import { TopBar } from "../../../components/top-bar";
import { WorkerTS } from "../../../typescript";
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

    WorkerTS.dispose();
    const tsButton = Button({
        style: "icon-large",
        iconLeft: "TypeScript"
    });
    WorkerTS.working = () => {
        tsButton.disabled = false;

        if (WorkerTS.reqs.size > 0) {
            tsButton.classList.add("working");
        } else {
            tsButton.classList.remove("working");
        }
    };
    tsButton.disabled = true;

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
        Editor({
            directory: project.location
        })
    );
    container.append(content);

    return container;
}
