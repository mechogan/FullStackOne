import CodeEditor from "@fullstacked/code-editor";
import config from "./lib/config";
import { CONFIG_TYPE } from "./types";
import { Store } from "./store";
import core_message from "../lib/core_message";
import { FileEvent, FileEventType } from "./views/project/file-event";
import { WorkerTS } from "./typescript";
import { EditorView } from "codemirror";
import {
    navigateToDefinition,
    tsAutocomplete,
    tsErrorLinter,
    tsTypeDefinition
} from "./typescript/extensions";
import { Diagnostic, linter, lintGutter } from "@codemirror/lint";
import { hoverTooltip } from "@codemirror/view";
import { autocompletion } from "@codemirror/autocomplete";
import fs from "../lib/fs";

const jsTsFilesExtensions = ["js", "mjs", ".cjs", "jsx", "ts", "tsx"];

const sassFilesExtensions = ["scss", "sass"];

const defaultExtensions = [
    EditorView.clickAddsSelectionRange.of((e) => e.altKey && !e.metaKey)
];

const tsExtensions = (filename: string) => [
    EditorView.updateListener.of((ctx) =>
        WorkerTS.call().updateFile(filename, ctx.state.doc.toString())
    ),
    EditorView.domEventHandlers({
        click: navigateToDefinition(filename)
    }),
    autocompletion({ override: [tsAutocomplete(filename)] }),
    hoverTooltip(tsTypeDefinition(filename))
];

export const codeEditor = new CodeEditor({
    setiFontLocation: null,
    agentConfigurations: await config.get(CONFIG_TYPE.AGENT),
    codemirrorExtraExtensions(filename) {
        const project = Store.projects.current.check();
        if (!project) return defaultExtensions;

        const fileExtension = filename.split(".").pop();
        if (!jsTsFilesExtensions.includes(fileExtension))
            return defaultExtensions;

        WorkerTS.start(project.id);
        return defaultExtensions.concat(tsExtensions(filename));
    },
    codemirrorLinters(filename) {
        const project = Store.projects.current.check();
        if (!project) return defaultExtensions;

        const fileExtension = filename.split(".").pop();

        if (jsTsFilesExtensions.includes(fileExtension)) {
            return [
                linter(tsErrorLinter(project.id, filename)),
                linter(buildErrorsLinter(filename)),
                lintGutter()
            ];
        } else if (sassFilesExtensions.includes(fileExtension)) {
            return [linter(buildErrorsLinter(filename)), lintGutter()];
        }

        return [];
    },
    async createNewFileName(suggestedName: string) {
        const project = Store.projects.current.check();
        if (!project) return suggestedName;

        if (suggestedName.endsWith(".chat")) {
            suggestedName = "chat/" + suggestedName;
        }

        if (!suggestedName.startsWith(project.id)) {
            suggestedName = project.id + "/" + suggestedName;
        }

        const pathComponents = suggestedName.split("/");

        const nameComponents = pathComponents.pop().split(".");
        const fileExtension = nameComponents.pop();
        let name = nameComponents.join(".");

        const dir = pathComponents.join("/");

        if (!(await fs.exists(dir))) {
            await fs.mkdir(dir);
        }

        let count = 2;
        const items = await fs.readdir(dir);
        while (items.includes(name + "." + fileExtension)) {
            if (name.match(/.*-\d+$/)) {
                name = name.replace(/-\d+$/, `-${count}`);
            } else {
                name = name + "-" + count;
            }
            count++;
        }

        const newFileName = dir + "/" + name + "." + fileExtension;
        await fs.writeFile(newFileName, "\n");
        return newFileName;
    }
});

codeEditor.addEventListener(
    "agent-configuration-update",
    ({ agentConfigurations }) => {
        config.save(CONFIG_TYPE.AGENT, agentConfigurations);
    }
);

codeEditor.addEventListener("file-update", async ({ fileUpdate }) => {
    if (await fs.exists(fileUpdate.name)) {
        fs.writeFile(fileUpdate.name, fileUpdate.contents, "code-editor");
    }
});

codeEditor.addEventListener("file-rename", async ({ fileRename }) => {
    const project = Store.projects.current.check();
    if (!project || !fileRename.oldName.startsWith(project.id)) return;

    if (await fs.exists(fileRename.oldName)) {
        await fs.unlink(fileRename.oldName);
    }
});

window.addEventListener("keydown", (e) => {
    if (e.key !== "s" || !(e.metaKey || e.ctrlKey)) return;

    e.preventDefault();
    e.stopPropagation();
    (
        codeEditor.getWorkspace()?.item?.current?.workspaceItem as any
    )?.format?.();
});

const closeTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

core_message.addListener("file-event", (msgStr) => {
    const project = Store.projects.current.check();
    if (!project) return;

    let shouldLint = false;

    const fileEvents = JSON.parse(msgStr) as FileEvent[];

    const workspace = codeEditor.getWorkspace();
    for (const event of fileEvents) {
        if (event.origin === "code-editor") continue;

        shouldLint = true;

        if (event.type === FileEventType.DELETED) {
            const name = project.id + event.paths.at(0).split(project.id).pop();
            if (!workspace.file.isOpen(name)) continue;
            closeTimeouts.set(
                name,
                setTimeout(() => {
                    workspace.file.close(name);
                }, 100)
            );
        } else if (event.type === FileEventType.CREATED) {
            const name = project.id + event.paths.at(0).split(project.id).pop();
            const timeout = closeTimeouts.get(name);
            if (timeout) clearTimeout(timeout);
        } else if (event.type === FileEventType.RENAME) {
            const oldName =
                project.id + event.paths.at(0).split(project.id).pop();
            const newName =
                project.id + event.paths.at(1).split(project.id).pop();
            workspace.file.rename(oldName, newName);

            if (!event.isFile) {
                fs.readdir(newName, { recursive: true }).then((children) => {
                    children.forEach((child) => {
                        workspace.file.rename(
                            oldName + "/" + child,
                            newName + "/" + child
                        );
                    });
                });
            }
        } else if (event.type === FileEventType.MODIFIED) {
            const name = project.id + event.paths.at(0).split(project.id).pop();

            const timeout = closeTimeouts.get(name);
            if (timeout) clearTimeout(timeout);

            if (workspace.file.isOpen(name)) {
                workspace.file.update(name, fs.readFile(name));
            }
        }
    }

    WorkerTS?.passFileEvents?.(fileEvents)?.then(() => {
        if (!shouldLint) return;
        codeEditor.getWorkspace().lint();
    });
});

function buildErrorsLinter(filename: string) {
    return async (view: EditorView) => {
        const buildErrors = Store.editor.codeEditor.buildErrors
            .check()
            .filter((err) => err.file === filename);
        return buildErrors.map((err) => {
            const from = view.state.doc.line(err.line).from + err.col;
            return {
                from,
                to: from + err.length,
                severity: "error",
                message: err.message
            } as Diagnostic;
        });
    };
}

setTimeout(() =>
    Store.editor.codeEditor.buildErrors.subscribe(async (errors) => {
        const workspace = codeEditor?.getWorkspace?.();
        if (!workspace) return;

        const filesWithErrors = new Set(errors.map(({ file }) => file));

        const toOpen = [];
        for (const f of filesWithErrors) {
            if (workspace.file.isOpen(f)) {
                workspace.file.open(f);
            } else {
                toOpen.push(workspace.file.open(f, fs.readFile(f)));
            }
        }
        await Promise.all(toOpen);
        workspace.lint();
        errors.forEach((e) =>
            workspace.file.goTo(e.file, {
                line: e.line,
                col: e.col
            })
        );
    })
);
