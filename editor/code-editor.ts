import CodeEditor from '@fullstacked/code-editor';
import config from './lib/config';
import { CONFIG_TYPE } from './types';
import fs from 'fs';
import { Store } from './store';
import core_message from '../lib/core_message';
import { FileEvent, FileEventType } from './views/project/file-event';

export const codeEditor = new CodeEditor({
    setiFontLocation: null,
    agentConfigurations: await config.get(CONFIG_TYPE.AGENT),
    codemirrorExtraExtensions: (filename) => {
        return []
    },
    createNewFileName: async (suggestedName: string) => {
        const project = Store.projects.current.check();
        if (!project) return suggestedName;

        if (!suggestedName.startsWith(project.id)) {
            suggestedName = project.id + "/" + suggestedName;
        }

        const pathComponents = suggestedName.split("/");

        const nameComponents = pathComponents.pop().split(".");
        const fileExtension = nameComponents.pop();
        let name = nameComponents.join(".");

        const dir = pathComponents.join("/");

        if (!await fs.exists(dir)) {
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

        return dir + "/" + name + "." + fileExtension;
    },
});

codeEditor.addEventListener("agent-configuration-update", ({ agentConfigurations }) => {
    config.save(CONFIG_TYPE.AGENT, agentConfigurations)
});

codeEditor.addEventListener("file-update", ({ fileUpdate }) => {
    fs.writeFile(fileUpdate.name, fileUpdate.contents);
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
    (codeEditor.getWorkspace()?.item?.current?.workspaceItem as any)?.format?.();
});

core_message.addListener("file-event", (msgStr) => {
    const project = Store.projects.current.check();
    if (!project) return;

    const fileEvent = JSON.parse(msgStr) as FileEvent[];
    for (const event of fileEvent) {
        if (event.type === FileEventType.DELETED) {
            const name = event.paths.at(0).split(project.id).pop();
            codeEditor.getWorkspace().file.close(project.id + name);
        } else if (event.type === FileEventType.RENAME) {
            const oldName = project.id + event.paths.at(0).split(project.id).pop();
            const newName = project.id + event.paths.at(1).split(project.id).pop();
            codeEditor.getWorkspace().file.rename(oldName, newName);
        }
    }
})