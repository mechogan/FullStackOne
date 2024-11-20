import { Button } from "../../components/primitives/button";
import { InputText } from "../../components/primitives/inputs";
import { TopBar } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";
import { ConsoleTerminal, createAndMoveProjectFromTmp, CreateLoader, tmpDir } from "./import-zip";
import { createProjectFromFullStackedFile } from "../../api/projects";
import { Project } from "../../api/config/types";
import stackNavigation from "../../stack-navigation";
import { BG_COLOR } from "../../constants";
import { ipcEditor } from "../../ipc";

export function CloneGit() {
    const { container, scrollable } = ViewScrollable();
    container.classList.add("view", "create-form");

    const topBar = TopBar({
        title: "Clone git repository"
    });

    container.prepend(topBar);

    const form = document.createElement("form");

    const repoUrlInput = InputText({
        label: "Git repository URL"
    });

    const cloneButton = Button({
        text: "Clone"
    });

    form.append(repoUrlInput.container, cloneButton);

    form.onsubmit = async (e) => {
        e.preventDefault();
        cloneButton.disabled = true;
        cloneGitRepo(repoUrlInput.input.value, scrollable)
            .then(() => stackNavigation.back())
            .catch(() => {});
    };

    scrollable.append(form);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: () => {
            removeCoreMessageListener("git-clone", logProgress)
        }
    })
}

let logProgress: (log: string) => void;
async function cloneGitRepo(url: string, scrollable: HTMLElement) {
    const consoleTerminal = ConsoleTerminal();

    logProgress = gitLogger(consoleTerminal);

    addCoreMessageListener("git-clone", logProgress);

    const loader = CreateLoader({
        text: "Cloning from remote..."
    });

    scrollable.append(loader, consoleTerminal.container);

    consoleTerminal.logger(`Cloning ${url}`);
    let result: Awaited<ReturnType<typeof ipcEditor.git.clone>>;
    try {
        result = await ipcEditor.git.clone(url, tmpDir);
    } catch(e) {
        consoleTerminal.logger(e.Error);
        throw e
    }

    const repoUrl = new URL(url);
    let defaultProjectTitle = repoUrl.pathname.slice(1); // remove forward slash
    // remove .git
    const pathnameComponents = repoUrl.pathname.split(".");
    if(pathnameComponents.at(-1) === "git") {
        defaultProjectTitle = pathnameComponents.slice(0, -1).join(".");
    }

    createAndMoveProjectFromTmp(consoleTerminal, defaultProjectTitle, url);

    consoleTerminal.logger(`Finished cloning ${url}`);
    consoleTerminal.logger(`Done`);

    removeCoreMessageListener("git-clone", logProgress);
}


export function gitLogger(consoleTerminal: ReturnType<typeof ConsoleTerminal>) {
    let currentPhase: string, currentHTMLElement: HTMLDivElement;
    return (progress: string) => {
        const phase = progress.split(":").at(0);
        if (phase !== currentPhase) {
            currentPhase = phase;
            currentHTMLElement = document.createElement("div");
            consoleTerminal.text.append(currentHTMLElement)
        }

        currentHTMLElement.innerText = progress
        consoleTerminal.text.scrollIntoView(false);
    };
}
