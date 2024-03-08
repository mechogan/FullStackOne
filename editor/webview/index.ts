import "./index.css";

import { Project } from "./views/project";
import { ProjectNew } from "./views/project-new";
import { Projects } from "./views/projects";

import type typeRPC from "../../src/webview";
import type api from "../api";
import { EsbuildInstall } from "./views/esbuild";
import { GitAuth } from "./views/git-auth";
import { Settings } from "./views/settings";
declare var rpc: typeof typeRPC<typeof api>;

const main = document.querySelector("main") as HTMLElement;
const clearView = () => Array.from(main.children).forEach((e) => e.remove());

await rpc().config.init();
const esbuildInstall = await rpc().esbuild.checkInstall();

const app = async () => {
    const gitAuth = new GitAuth();
    (window as any).onPush["gitAuth"] = gitAuth.receivedMessage;

    const settings = new Settings();
    const projectsView = new Projects();

    projectsView.newProjectAction = async () => {
        clearView();
        main.append(await projectNewView.render());
    };
    projectsView.selectProjectAction = async (projectPath) => {
        clearView();
        projectView.packagesView = false;
        projectView.setProject(projectPath);
        main.append(await projectView.render());
    };
    projectsView.goToSettings = async () => {
        clearView();
        main.append(await settings.render());
    };

    settings.goToPackages = async () => {
        clearView();
        projectView.packagesView = true;
        projectView.setProject({
            title: "Packages",
            location: await rpc().packages.directory(),
            createdDate: null
        });

        main.append(await projectView.render());
    };
    settings.backAction = async () => {
        clearView();
        main.append(await projectsView.render());
    }

    const projectNewView = new ProjectNew();
    projectNewView.cancelAction = async () => {
        clearView();
        main.append(await projectsView.render());
    };
    projectNewView.didCreateProjectAction = async (newProjectPath) => {
        clearView();
        projectView.packagesView = false;
        projectView.setProject(newProjectPath);
        main.append(await projectView.render());
    };

    const projectView = new Project();
    projectView.backAction = async () => {
        clearView();
        if(projectView.packagesView) {
            main.append(await settings.render());
        } else {
            main.append(await projectsView.render());
        }
       
    };

    clearView();
    main.append(await projectsView.render());

    // for test puposes
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("demo")) {
        const demoProject = (await rpc().projects.list()).find(
            ({ title }) => title === "Demo"
        );
        if (demoProject) {
            projectView.setProject(demoProject);
            clearView();
            main.append(await projectView.render());
            await rpc().projects.run(demoProject);
        }
    }
};

if (!esbuildInstall) {
    const esbuildInstall = new EsbuildInstall();
    esbuildInstall.onComplete = app;
    main.append(esbuildInstall.render());
    esbuildInstall.install();
} else {
    await app();
}
