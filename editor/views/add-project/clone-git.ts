import api from "../../api";
import rpc from "../../rpc";
import { Button } from "../../components/primitives/button";
import { InputText } from "../../components/primitives/inputs";
import { TopBar } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";
import { ConsoleTerminal, CreateLoader } from "./import-zip";
import { createProjectFromFullStackedFile } from "../../api/projects";
import { GitProgressEvent } from "isomorphic-git";
import { Project } from "../../api/config/types";
import stackNavigation from "../../stack-navigation";
import { BG_COLOR } from "../../constants";

type CloneGitOpts = {
    didCloneProject: (project: Project) => void;

    // for deeplinks
    repoUrl?: string;
};

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

        const loader = CreateLoader({
            text: "Cloning from remote..."
        });

        const consoleTerminal = ConsoleTerminal();

        scrollable.append(loader, consoleTerminal.container);

        consoleTerminal.logger(`Cloning ${repoUrlInput.input.value}`);

        const tmpDirectory = "tmp";
        consoleTerminal.logger(`Cloning into ${tmpDirectory} directory`);

        // await api.git.clone(repoUrlInput.input.value, tmpDirectory, {
        //     onProgress: gitLogger(consoleTerminal.text)
        // });
        consoleTerminal.logger(``);

        const project = await createProjectFromFullStackedFile({
            getDirectoryContents: () =>
                rpc().fs.readdir(tmpDirectory, {
                    absolutePath: true
                }) as Promise<string[]>,
            getFileContents: (filename) =>
                rpc().fs.readFile(tmpDirectory + "/" + filename, {
                    absolutePath: true,
                    encoding: "utf8"
                }) as Promise<string>,
            alternateTitle: repoUrlInput.input.value
                .split("/")
                .pop()
                .split(".")
                .shift(),
            alternateRepo: repoUrlInput.input.value,
            logger: consoleTerminal.logger
        });

        await rpc().fs.rename(tmpDirectory, project.location, {
            absolutePath: true
        });
        consoleTerminal.logger(`Moved tmp to ${project.location}`);
        consoleTerminal.logger(`Done`);

        // opts.didCloneProject(project);
    };

    scrollable.append(form);

    // if (opts.repoUrl) {
    //     repoUrlInput.input.value = opts.repoUrl;
    //     setTimeout(() => cloneButton.click(), 1);
    // }

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR
    })
}

export function gitLogger(el: HTMLElement) {
    let currentPhase: string, currentHTMLElement: HTMLDivElement;
    return (progress: GitProgressEvent) => {
        if (progress.phase !== currentPhase) {
            currentPhase = progress.phase;
            currentHTMLElement = document.createElement("div");
            el.append(currentHTMLElement);
        }

        if (progress.total) {
            currentHTMLElement.innerText = `${progress.phase} ${progress.loaded}/${progress.total} (${((progress.loaded / progress.total) * 100).toFixed(2)}%)`;
        } else {
            currentHTMLElement.innerText = `${progress.phase} ${progress.loaded}`;
        }

        el.scrollIntoView(false);
    };
}
