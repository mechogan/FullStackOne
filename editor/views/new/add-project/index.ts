import { Button } from "../../../components/primitives/button";
import { TopBar } from "../../../components/top-bar";
import { BG_COLOR } from "../../../constants";
import stackNavigation from "../../../stack-navigation";
import { CloneGit } from "./clone-git";
import { CreateEmpty } from "./create-empty";
import { ImportZip } from "./import-zip";

export type AddProjectOpts = {
    didAddProject: () => void;
};

export function AddProject(opts: AddProjectOpts) {
    const container = document.createElement("div");
    container.id = "add-project";
    container.classList.add("view");

    const topBar = TopBar({
        title: "Add Project"
    });

    container.append(topBar);

    const buttonsContainer = document.createElement("div");
    buttonsContainer.classList.add("buttons");

    const cloneGitButton = Button({
        text: "Clone git repository",
        iconLeft: "Git"
    });
    cloneGitButton.onclick = () =>
        stackNavigation.navigate(CloneGit(), BG_COLOR);

    const importZipButton = Button({
        text: "Import zip",
        iconLeft: "Archive"
    });
    importZipButton.onclick = () =>
        stackNavigation.navigate(ImportZip(opts), BG_COLOR);

    const createEmptyButton = Button({
        text: "Create empty project",
        iconLeft: "Glitter"
    });
    createEmptyButton.onclick = () =>
        stackNavigation.navigate(CreateEmpty(), BG_COLOR);

    buttonsContainer.append(cloneGitButton, importZipButton, createEmptyButton);
    container.append(buttonsContainer);

    return container;
}
