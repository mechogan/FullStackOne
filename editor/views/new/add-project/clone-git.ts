import api from "../../../api";
import rpc from "../../../rpc";
import { Button } from "../../../components/primitives/button";
import { InputText } from "../../../components/primitives/inputs";
import { TopBar } from "../../../components/top-bar";
import { ViewScrollable } from "../../../components/view-scrollable";
import { ConsoleTerminal, CreateLoader } from "./import-zip";
import { createProjectFromFullStackedFile } from "../../../api/projects";

type CloneGitOpts = {
    didCloneProject: () => void;
};

export function CloneGit(opts: CloneGitOpts) {
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

        const loader = CreateLoader({
            text: "Cloning from remote..."
        });

        const consoleTerminal = ConsoleTerminal();

        scrollable.append(loader, consoleTerminal.container);

        consoleTerminal.text.innerText += `Cloning ${repoUrlInput.input.value}\n`;

        const tmpDirectory = "tmp";
        consoleTerminal.text.innerText += `Cloning into ${tmpDirectory} directory\n`;

        let currentPhase: string, currentHTMLElement: HTMLElement;
        await api.git.clone(
            repoUrlInput.input.value,
            tmpDirectory,
            (progress) => {
                if (progress.phase !== currentPhase) {
                    currentPhase = progress.phase;
                    currentHTMLElement = document.createElement("div");
                    consoleTerminal.text.append(currentHTMLElement);
                }

                if (progress.total) {
                    currentHTMLElement.innerText = `${progress.phase} ${progress.loaded}/${progress.total} (${((progress.loaded / progress.total) * 100).toFixed(2)}%)`;
                } else {
                    currentHTMLElement.innerText = `${progress.phase} ${progress.loaded}`;
                }
            }
        );
        consoleTerminal.text.innerText += `\n`;

        const project = await createProjectFromFullStackedFile({
            getDirectoryContents: () =>
                rpc().fs.readdir(tmpDirectory, {
                    absolutePath: true
                }) as Promise<string[]>,
            getFileContents: (filename) =>
                rpc().fs.readFile(
                    tmpDirectory + "/" + filename,
                    { absolutePath: true, encoding: "utf8" }
                ) as Promise<string>,
            alternateTitle: repoUrlInput.input.value
                .split("/")
                .pop()
                .split(".")
                .shift(),
            logger: (message) =>
                (consoleTerminal.text.innerText += `${message}\n`)
        });

        await rpc().fs.rename(tmpDirectory, project.location, {
            absolutePath: true
        });
        consoleTerminal.text.innerText += `Moved tmp to ${project.location}\n`;

        consoleTerminal.text.innerText += `Done`;

        opts.didCloneProject();
    };

    scrollable.append(form);

    return container;
}
