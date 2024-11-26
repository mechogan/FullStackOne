import { Platform } from "../../../src/fullstacked";
import { Button } from "../../components/primitives/button";
import { TopBar } from "../../components/top-bar";
import { BG_COLOR, IMPORT_ZIP_ID } from "../../constants";
import stackNavigation from "../../stack-navigation";
import { Store } from "../../store";
import { CloneGit } from "./clone-git";
import { CreateEmpty } from "./create-empty";
import { ImportZip } from "./import-zip";

export function AddProject() {
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
    cloneGitButton.onclick = () => CloneGit();
    cloneGitButton.disabled = platform === Platform.WASM;

    const importZipButton = Button({
        text: "Import zip",
        iconLeft: "Archive"
    });
    importZipButton.id = IMPORT_ZIP_ID;
    importZipButton.onclick = ImportZip;

    const createEmptyButton = Button({
        text: "Create empty project",
        iconLeft: "Glitter"
    });
    createEmptyButton.onclick = CreateEmpty;

    buttonsContainer.append(cloneGitButton, importZipButton, createEmptyButton);
    container.append(buttonsContainer);

    // on project list update (most probably new project created)
    // go back
    const goBackOnNewProject = () => stackNavigation.back();
    Store.projects.list.subscribe(goBackOnNewProject);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: () => {
            Store.projects.list.unsubscribe(goBackOnNewProject);
        }
    });
}
