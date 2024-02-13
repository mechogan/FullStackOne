import "./index.css";

import { Editor } from '../editor';
import { FileTree } from '../file-tree';
import { Console } from "../console";


import type { Project as TypeProject } from "../../../api/projects/types";
import type typeRPC from "../../../../src/webview";
import type api from "../../../api";

declare var rpc: typeof typeRPC<typeof api>;

export class Project {
    backAction: () => void;

    private container: HTMLDivElement;
    private project: TypeProject;

    fileTree: {
        instance: FileTree,
        element: Awaited<ReturnType<FileTree["render"]>> | null
    } = {
            instance: new FileTree(),
            element: null
        };
    console = new Console();

    private tabsContainer = document.createElement("ul");
    private editorsContainer = document.createElement("div");

    private currentFile: string;
    private editors: Editor[] = [];

    constructor() {
        this.fileTree.instance.onItemSelect = (item => {
            if (!item || item.isDirectory)
                return;

            const joinedPath = item.path.join("/");
            if (!this.editors.find(({ filePath }) => filePath.join("/") === joinedPath)) {
                this.editors.push(new Editor(item.path));
            }

            this.currentFile = joinedPath;

            this.renderEditors();
        });


        (window as any).onPush["buildError"] = (message: string) => {
            const errors = JSON.parse(message);

            errors.forEach(error => {
                const file = error.location?.file || error.Location?.File;

                let fileName = this.project.location + file.split(this.project.location).pop();
                let editor = this.editors.find(({ filePath }) => filePath.join("/") === fileName);
                if(!editor) {
                    editor = new Editor(fileName.split("/"));
                    this.editors.push(editor);
                }

                editor.addBuildError({
                    line: error.location?.line || error.Location?.Line, 
                    col: error.location?.column || error.Location?.Column, 
                    length: error.location?.length || error.Location?.Length, 
                    message: error.text || error.Text
                });

                this.currentFile = fileName;
            });

            this.renderEditors();
        }

        const openConsole = () => {
            this.console.fitAddon.fit();
            this.container.classList.add("console-opened");
            setTimeout(() => { this.console.fitAddon.fit() }, 350);
        }

        const writeParagraph = (contents: string) => {
            contents.split("\n").forEach(ln => this.console.term.writeln(ln));
        }

        (window as any).onPush["log"] = (message: string) => {
            const logs = JSON.parse(message);
            if(logs.length){
                openConsole();
            }
            const str = logs.map(log => typeof log === "string" ? log : JSON.stringify(log, null, 2)).join("  ")
            writeParagraph(str);
        }
        (window as any).onPush["error"] = (message: string) => {
            openConsole();
            const error: {message: string, name: string, stack: string} = JSON.parse(message);
            writeParagraph(error.message)
            writeParagraph(error.name)
            writeParagraph(error.stack)
        }
    }

    setProject(project: TypeProject) {
        if (project === this.project)
            return;

        this.project = project;
        this.fileTree.instance.setBaseDirectory(project.location);

        this.editors = [];
        this.renderEditors();
    }

    private async renderToolbar() {
        const container = document.createElement("div");
        container.classList.add("top-bar")

        const leftSide = document.createElement("div");

        const backButton = document.createElement("button");
        backButton.innerHTML = await (await fetch("/assets/icons/arrow-left.svg")).text();
        backButton.classList.add("text");
        backButton.addEventListener("click", this.backAction);
        leftSide.append(backButton);

        const fileTreeToggle = document.createElement("button");
        fileTreeToggle.innerHTML = await (await fetch("/assets/icons/side-panel.svg")).text();
        fileTreeToggle.classList.add("text");
        fileTreeToggle.addEventListener("click", () => {
            this.container.classList.toggle("side-panel-closed");
            setTimeout(() => {this.console.fitAddon.fit()}, 350)
        })
        leftSide.append(fileTreeToggle);

        const projectTitle = document.createElement("h3");
        projectTitle.innerText = this.project.title;
        leftSide.append(projectTitle);


        const rightSide = document.createElement("div");

        const shareButton = document.createElement("button");
        shareButton.classList.add("text");
        shareButton.innerHTML = await (await fetch("/assets/icons/share.svg")).text();
        shareButton.addEventListener("click", async () => {
            await rpc().projects.zip(this.project);
            const refreshedFileTree = await this.fileTree.instance.render();
            this.fileTree.element?.replaceWith(refreshedFileTree);
            this.fileTree.element = refreshedFileTree;
        });
        rightSide.append(shareButton);

        const runButton = document.createElement("button");
        runButton.classList.add("text");
        runButton.innerHTML = await (await fetch("/assets/icons/run.svg")).text();
        runButton.addEventListener("click", async () => {
            await Promise.all(this.editors.map(editor => {
                editor.clearBuildErrors();
                return editor.updateFile();
            }));
            this.renderEditors();
            this.console.term.clear();
            rpc().projects.run(this.project);
        });
        rightSide.append(runButton);

        container.append(leftSide);
        container.append(rightSide);

        return container;
    }

    renderEditors() {
        Array.from(this.editorsContainer.children).forEach(child => child.remove());

        const tabsContainer = document.createElement("ul");
        tabsContainer.classList.add("tabs-container");

        this.editors.forEach(async (editor, index) => {
            const tab = document.createElement("li");
            if(editor.hasBuildErrors()){
                tab.classList.add("has-errors")
            }
            tab.innerText = editor.filePath.at(-1) || "file";
            tab.addEventListener("click", () => {
                this.currentFile = editor.filePath.join("/");
                this.renderEditors();
            })

            const removeBtn = document.createElement("button");
            removeBtn.classList.add("text", "small")
            removeBtn.innerHTML = await (await fetch("/assets/icons/close.svg")).text();
            removeBtn.addEventListener("click", async e => {
                e.stopPropagation();
                await editor.updateFile();
                this.editors.splice(index, 1);
                this.renderEditors();
            })
            tab.append(removeBtn);

            tabsContainer.append(tab);

            if (editor.filePath.join("/") === this.currentFile) {
                tab.classList.add("active");
                this.editorsContainer.append(await editor.render());
            }
        });

        this.tabsContainer.replaceWith(tabsContainer);
        this.tabsContainer = tabsContainer;

    }

    async renderConsole(){
        const consoleContainer = document.createElement("div");
        consoleContainer.classList.add("console");
        consoleContainer.append(this.console.render());

        const toggleConsoleButton = document.createElement("button");
        toggleConsoleButton.classList.add("text");
        toggleConsoleButton.innerHTML = await (await fetch("assets/icons/caret-down.svg")).text();
        toggleConsoleButton.addEventListener("click", () => {
            this.container.classList.toggle("console-opened");
            setTimeout(() => { this.console.fitAddon.fit() }, 350)
        })
        consoleContainer.append(toggleConsoleButton);
        return consoleContainer
    }

    async render() {
        this.container = document.createElement("div");
        this.container.classList.add("project");

        this.container.append(await this.renderToolbar());

        const fileTreeContainer = document.createElement("div");
        fileTreeContainer.classList.add("left-sidebar")
        this.fileTree.instance.allowDeletion = true;
        this.fileTree.element = await this.fileTree.instance.render()
        fileTreeContainer.append(this.fileTree.element);
        this.container.append(fileTreeContainer);

        this.tabsContainer.classList.add("tabs-container");
        this.container.append(this.tabsContainer);

        this.editorsContainer.classList.add("editor-container");
        this.container.append(this.editorsContainer);

        this.container.append(await this.renderConsole());

        return this.container;
    }
}