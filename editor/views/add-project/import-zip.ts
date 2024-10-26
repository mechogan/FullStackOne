import prettyBytes from "pretty-bytes";
import api from "../../api";
import rpc from "../../rpc";
import { Loader } from "../../components/loader";
import { InputFile } from "../../components/primitives/inputs";
import { TopBar } from "../../components/top-bar";
import { ViewScrollable } from "../../components/view-scrollable";
import * as zip from "@zip.js/zip.js";
import { createProjectFromFullStackedFile } from "../../api/projects";
import { gitLogger } from "./clone-git";
import { IMPORT_PROJECT_FILE_INPUT_ID } from "../../constants";

type ImportZipOpts = {
    didImportProject: () => void;

    // only for demo import on first launch
    zip?: {
        data: Uint8Array;
        name: string;
    };
};

export function ImportZip(opts: ImportZipOpts) {
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

    zipFileInput.input.onchange = async () => {
        const file = zipFileInput.input.files?.[0];
        if (!file) return;

        zipFileInput.input.disabled = true;

        const loader = CreateLoader({
            text: "Importing Project..."
        });

        const consoleTerminal = ConsoleTerminal();

        scrollable.append(loader, consoleTerminal.container);

        consoleTerminal.logger(`Importing file: ${file.name}`);

        const zipData = new Uint8Array(await file.arrayBuffer());

        consoleTerminal.logger(`ZIP size: ${prettyBytes(zipData.byteLength)}`);

        const entries = await new zip.ZipReader(
            new zip.Uint8ArrayReader(zipData)
        ).getEntries();

        consoleTerminal.logger(`ZIP item count: ${entries.length}`);

        const project = await createProjectFromFullStackedFile({
            getDirectoryContents: async () =>
                entries.map((entry) => entry.filename),
            getFileContents: async (filename) => {
                const data = await entries
                    .find((entry) => entry.filename === filename)
                    .getData(new zip.Uint8ArrayWriter());
                return new TextDecoder().decode(data);
            },
            alternateTitle: file.name.split(".").shift(),
            logger: consoleTerminal.logger
        });

        if (project.gitRepository?.url) {
            consoleTerminal.logger(`Found git repository URL`);
            consoleTerminal.logger(`Trying to clone before unpacking`);
            try {
                await api.git.clone(
                    project.gitRepository.url,
                    project.location,
                    {
                        onProgress: gitLogger(consoleTerminal.text)
                    }
                );
            } catch (e) {
                consoleTerminal.logger(`Failed to clone git repository`);
                await rpc().fs.rmdir(`${project.location}/.git`, {
                    absolutePath: true
                });
            }
        }

        consoleTerminal.text.innerText += `Unpacking\n`;
        for (let i = 0; i < entries.length; i++) {
            const entry = entries.at(i);

            const pathComponents = entry.filename.split("/");
            const filename = pathComponents.pop();
            const directory = pathComponents.join("/");
            const fullPath = (directory ? directory + "/" : "") + filename;

            consoleTerminal.logger(
                `Writing file: ${filename} [${fullPath}] (${i + 1}/${entries.length})`
            );

            await rpc().fs.mkdir(project.location + "/" + directory, {
                absolutePath: true
            });
            const data = await entry.getData(new zip.Uint8ArrayWriter());
            await rpc().fs.writeFile(project.location + "/" + fullPath, data, {
                absolutePath: true
            });
        }

        consoleTerminal.logger(`Finish importing ${file.name}`);
        consoleTerminal.logger("Done");

        opts.didImportProject();
    };

    scrollable.append(form);

    if (opts.zip) {
        const file = new File([opts.zip.data], opts.zip.name, {
            type: "application/octet-stream",
            lastModified: Date.now()
        });
        const container = new DataTransfer();
        container.items.add(file);
        zipFileInput.input.files = container.files;
        zipFileInput.input.onchange(null);
    }

    return container;
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
