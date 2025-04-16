import { Chat } from "@fullstacked/code-editor";
import { codeEditor } from "../code-editor";
import { deeplink } from "../deeplink";
import packages from "../lib/packages";
import stackNavigation from "../stack-navigation";
import { Store } from "../store";
import { Project } from "../types";
import { updatePackagesView } from "../views/packages";

export type Command = {
    name: string;
    suggestions?(prefix: string): string[] | Promise<string[]>;
    exec?(args: string[]): boolean;
    alias?: string[];
    subcommand?: Command[];
};

let projectsList = [];
Store.projects.list.subscribe((l) => (projectsList = l.map(({ id }) => id)));

export const commands: Command[] = [
    {
        name: "npm",
        subcommand: [
            {
                name: "install",
                alias: ["i"],
                exec(args) {
                    let dev = false,
                        quick = false;
                    if (args.includes("--save-dev")) {
                        dev = true;
                        args.splice(args.indexOf("--save-dev"), 1);
                    }
                    if (args.includes("--quick")) {
                        quick = true;
                        args.splice(args.indexOf("--quick"), 1);
                    }
                    packages.install(
                        Store.projects.current.check(),
                        args,
                        updatePackagesView,
                        quick,
                        dev
                    );
                    return true;
                }
            }
        ]
    },
    {
        name: "gh",
        subcommand: [
            {
                name: "repo",
                subcommand: [
                    {
                        name: "clone",
                        exec(args) {
                            const repo = args.at(0);
                            const deeplinkUrl = `fullstacked://https//github.com/${repo}.git`;
                            deeplink(deeplinkUrl);
                            return true;
                        }
                    }
                ]
            }
        ]
    },
    {
        name: "back",
        exec() {
            stackNavigation.back();
            return true;
        }
    },
    {
        suggestions: () => projectsList,
        exec(args) {
            const projectId = args.at(0);
            if (!projectsList.find((id) => id === projectId)) {
                return false;
            }
            const projects = Store.projects.list.check();
            const project = projects.find(({ id }) => id === projectId);
            Store.projects.setCurrent(project);
            return true;
        },
        name: "code"
    },
    {
        suggestions: () => projectsList,
        exec(args) {
            const projectId = args.at(0);
            let project: Project = null;
            if (projectId === ".") {
                project = Store.projects.current.check();
            } else if (!projectsList.find((id) => id === projectId)) {
                return false;
            }
            if (!project) {
                const projects = Store.projects.list.check();
                project = projects.find(({ id }) => id === projectId);
            }

            if (project) {
                Store.projects.build(project);
                return true;
            }

            return false;
        },
        name: "open"
    },
    {
        name: "add",
        exec(args) {
            const repoUrl = args.at(0);
            const deeplinkUrl = `fullstacked://${repoUrl}`;
            deeplink(deeplinkUrl);
            return true;
        }
    },
    {
        name: "chat",
        exec(args) {
            const project = Store.projects.current.check();
            if (project) {
                codeEditor.getWorkspace().item.add(new Chat());
            }

            return true;
        }
    }
];
