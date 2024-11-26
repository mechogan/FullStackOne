import { Button } from "../../components/primitives/button";
import { InputText } from "../../components/primitives/inputs";
import { TopBar } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";
import {
    ConsoleTerminal,
    createAndMoveProjectFromTmp,
    CreateLoader,
    tmpDir
} from "./import-zip";
import stackNavigation from "../../stack-navigation";
import { BG_COLOR } from "../../constants";
import { ipcEditor } from "../../ipc";

export function CloneGit(repoUrl?: string) {
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

    const submit = async () => {
        cloneButton.disabled = true;
        cloneGitRepo(repoUrlInput.input.value, scrollable)
            .then(() => stackNavigation.back())
            .catch(() => {});
    }
    form.onsubmit = (e) => {
        e.preventDefault();
        submit();
    };

    scrollable.append(form);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR,
        onDestroy: () => {
            removeCoreMessageListener("git-clone", checkForDone);
        }
    });

    if(repoUrl) {
        repoUrlInput.input.value = repoUrl;
        submit();
    }
}

let checkForDone: (progress: string) => void;
async function cloneGitRepo(url: string, scrollable: HTMLElement) {
    const consoleTerminal = ConsoleTerminal();

    const logProgress = gitLogger(consoleTerminal);

    const donePromise = new Promise<void>((resolve) => {
        checkForDone = (progress: string) => {
            if (progress.trim().endsWith("done")) {
                resolve();
            }
            logProgress(progress);
        };
    });

    addCoreMessageListener("git-clone", checkForDone);

    const loader = CreateLoader({
        text: "Cloning from remote..."
    });

    scrollable.append(loader, consoleTerminal.container);

    consoleTerminal.logger(`Cloning ${url}`);
    try {
        await ipcEditor.git.clone(url, tmpDir);
    } catch (e) {
        consoleTerminal.logger(e.Error);
        throw e;
    }

    await donePromise;

    const repoUrl = new URL(url);
    let defaultProjectTitle = repoUrl.pathname.slice(1); // remove forward slash
    // remove .git
    const pathnameComponents = defaultProjectTitle.split(".");
    if (pathnameComponents.at(-1) === "git") {
        defaultProjectTitle = pathnameComponents.slice(0, -1).join(".");
    }

    createAndMoveProjectFromTmp(consoleTerminal, defaultProjectTitle, url);

    consoleTerminal.logger(`Finished cloning ${url}`);
    consoleTerminal.logger(`Done`);

    removeCoreMessageListener("git-clone", checkForDone);
}

export function gitLogger(consoleTerminal: ReturnType<typeof ConsoleTerminal>) {
    let currentPhase: string, currentHTMLElement: HTMLDivElement;
    return (progress: string) => {
        const progressLines = progress.split("\n");
        progressLines.forEach((line) => {
            if (!line.trim()) return;

            const phase = line.split(":").at(0);
            if (phase !== currentPhase) {
                currentPhase = phase;
                currentHTMLElement = document.createElement("div");
                consoleTerminal.text.append(currentHTMLElement);
            }

            currentHTMLElement.innerText = line.trim();
            consoleTerminal.text.scrollIntoView(false);
        });
    };
}
