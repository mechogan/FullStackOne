import CodeEditor from '@fullstacked/code-editor';
import config from './lib/config';
import { CONFIG_TYPE } from './types';
import { EditorView } from 'codemirror';
import fs from 'fs';
import { Store } from './store';
import core_message from '../lib/core_message';
import { FileEvent, FileEventType } from './views/project/file-event';

export const codeEditor = new CodeEditor({
    setiFontLocation: null,
    agentConfigurations: await config.get(CONFIG_TYPE.AGENT),
    codemirrorExtraExtensions: (filename) => {
        return [
            EditorView.updateListener.of(view => {
                fs.writeFile(filename, view.state.doc.toString());
            })
        ];
    },
    validateNewFileName: (suggestedName: string) => {
        const project = Store.projects.current.check();
        if(!project) return suggestedName;

        if(!suggestedName.startsWith(project.id)) {
            return project.id + "/" + suggestedName;
        }
    },
});

codeEditor.addEventListener("agent-configuration-update", ({agentConfigurations}) => {
    config.save(CONFIG_TYPE.AGENT, agentConfigurations)
});

window.addEventListener("keydown", (e) => {
    if (e.key !== "s" || !(e.metaKey || e.ctrlKey)) return;

    e.preventDefault();
    e.stopPropagation();
    (codeEditor.getWorkspace()?.item?.current?.workspaceItem as any)?.format?.();
});

core_message.addListener("file-event", (msgStr) => {
    const project = Store.projects.current.check();
    if(!project) return;

    const fileEvent = JSON.parse(msgStr) as FileEvent[];
    for(const event of fileEvent){
        if(event.type === FileEventType.DELETED) {
            const name = event.paths.at(0).split(project.id).pop();
            codeEditor.getWorkspace().file.close(project.id + name);
        }
    }
})