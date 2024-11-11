import prettyBytes from "pretty-bytes";
import { Loader } from "../../components/loader";
import { InputFile } from "../../components/primitives/inputs";
import { TopBar } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";
import { createProjectFromFullStackedFile } from "../../api/projects";
import { BG_COLOR, IMPORT_PROJECT_FILE_INPUT_ID } from "../../constants";
import stackNavigation from "../../stack-navigation";
import { ipcEditor } from "../../store/ipc";
import { title } from "process";
import slugify from "slugify";
import { Store } from "../../store";


export function ImportZip() {
    const { container, scrollable } = ViewScrollable();
    container.classList.add("view", "create-form");

    const topBar = TopBar({
        title: "Import zip"
    });

    container.prepend(topBar);

    const form = document.createElement("form");

    const zipFileInput = InputFile({
        label: "Project ZIP"
    });
    zipFileInput.input.id = IMPORT_PROJECT_FILE_INPUT_ID;
    form.append(zipFileInput.container);

    zipFileInput.input.onchange = () => {
        const file = zipFileInput.input.files?.[0];
        if (!file) return;
        zipFileInput.input.disabled = true;
        loadZipFile(file, scrollable).then(() => {
            stackNavigation.back()
        });
    }

    scrollable.append(form);

    stackNavigation.navigate(container, {
        bgColor: BG_COLOR
    })
}

export function CreateLoader(opts: { text: string }) {
    const container = document.createElement("div");
    container.classList.add("create-loader");

    const text = document.createElement("div");
    text.innerText = opts.text;

    container.append(Loader(), text);

    return container;
}

export function ConsoleTerminal() {
    const container = document.createElement("div");
    container.classList.add("create-terminal");

    const text = document.createElement("pre");
    container.append(text);

    const logger = (message: string) => {
        (text.innerText += `${message}\n`), text.scrollIntoView(false);
    };

    return { container, text, logger };
}


async function loadZipFile(file: File, scrollable: HTMLElement) {
    const loader = CreateLoader({
        text: "Importing Project..."
    });

    const consoleTerminal = ConsoleTerminal();

    scrollable.append(loader, consoleTerminal.container);

    consoleTerminal.logger(`Importing file: ${file.name}`);

    const zipData = new Uint8Array(await file.arrayBuffer());

    consoleTerminal.logger(`ZIP size: ${prettyBytes(zipData.byteLength)}`);

    const tmpDir = ".tmp";

    consoleTerminal.text.innerText += `Unpacking\n`;
    await ipcEditor.archive.unzip(tmpDir, zipData);

    consoleTerminal.text.innerText += `Looking for .fullstacked file\n`;
    const contents = await ipcEditor.fs.readdir(tmpDir)

    // remove .zip extension
    const defaultName = file.name.split(".").slice(0, -1).join(".");

    const project: Parameters<typeof Store.projects.create>[0] = {
        title: defaultName,
        id: slugify(defaultName, { lower: true })
    }

    if (contents.includes(".fullstacked")) {
        try {
            const fullstackedFile = await ipcEditor.fs.readFile(".tmp/.fullstacked", { encoding: "utf8" });
            const fullstackedProjectData = JSON.parse(fullstackedFile);
            consoleTerminal.text.innerText += `Found valid .fullstacked file\n`;
            consoleTerminal.text.innerText += `${JSON.stringify(fullstackedFile, null, 2)}\n`;
            project.title = fullstackedProjectData.title || project.title;
            project.id    = fullstackedProjectData.id || project.id;
            if(fullstackedProjectData.git?.url) {
                project.gitRepository = {
                    url: fullstackedProjectData.git?.url
                }
            }
        } catch(e) {
            consoleTerminal.text.innerText += `Found invalid .fullstacked file\n`;

        }
    }

    consoleTerminal.text.innerText += `Creating Project\n`;
    consoleTerminal.text.innerText += `${JSON.stringify(project, null, 2)}\n`;

    await ipcEditor.fs.rename(tmpDir, project.id);

    Store.projects.create(project);

    consoleTerminal.logger(`Finished importing ${file.name}`);
    consoleTerminal.logger("Done");
};