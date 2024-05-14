import { BrowserWindow } from "electron";
import type { Project } from "../../../editor/api/projects/types";
import { Adapter } from "../../../src/adapter/fullstacked";
import { initAdapter } from "../../node/src/adapter";
import { InstanceEditor } from "./instanceEditor";

export class Instance {
    project: Project;
    window: BrowserWindow;
    adapter: Adapter;

    constructor(project: Project) {
        this.project = project;

        this.adapter = initAdapter(
            InstanceEditor.rootDirectory + "/" + this.project.location,
            "electron"
        );
    }

    push = (messageType: string, message: string) => {
        this.window.webContents.executeJavaScript(
            `window.push("${messageType}", \`${message.replace(/\\/g, "\\\\")}\`)`
        );
    };

    restart() {
        this.window.reload();
        this.window.focus();
    }

    start(hostname: string) {
        this.window = new BrowserWindow({
            width: 800,
            height: 600,
            title: this.project.title,
            icon: "icons/icon.png"
        });

        return this.window.loadURL(`http://${hostname}`);
    }
}
