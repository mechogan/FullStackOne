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

/// utils ///
const main = document.querySelector("main") as HTMLElement;
const clearView = () => Array.from(main.children).forEach((e) => e.remove());

/// Git Auth View ///
const gitAuth = new GitAuth();
(window as any).onPush["gitAuth"] = gitAuth.receivedMessage;

/// Projects View ///
const projectsView = new Projects();
projectsView.newProjectAction = async () => {
    clearView();
    main.append(await projectNewView.render());
};
projectsView.selectProjectAction = async (projectPath) => {
    clearView();
    projectView.setProject(projectPath);
    main.append(await projectView.render());
};
projectsView.goToSettings = async () => {
    clearView();
    main.append(await settings.render());
};

/// Settings View ///
const settings = new Settings();
settings.goToPackages = async () => {
    clearView();
    projectView.setProject({
        title: "Packages",
        location: await rpc().packages.directory(),
        createdDate: null
    });
    projectView.packagesView = true;

    main.append(await projectView.render());
};
settings.backAction = async () => {
    clearView();
    main.append(await projectsView.render());
};

/// Project New View ///
const projectNewView = new ProjectNew();
projectNewView.cancelAction = async () => {
    clearView();
    main.append(await projectsView.render());
};
projectNewView.didCreateProjectAction = async (newProjectPath) => {
    clearView();
    projectView.setProject(newProjectPath);
    main.append(await projectView.render());
};

/// Project View ///
const projectView = new Project();
(window as any).onPush["launchURL"] = async (projectStr: string) => {
    const lauchedProject = JSON.parse(projectStr);
    projectView.setProject(lauchedProject);
    const projectRendered = await projectView.render();
    clearView();
    main.append(projectRendered);
    await projectView.runProject();
};
projectView.backAction = async () => {
    clearView();
    if (projectView.packagesView) {
        main.append(await settings.render());
    } else {
        main.append(await projectsView.render());
    }
};

// pre-init
await rpc().config.init();
const esbuildInstall = await rpc().esbuild.checkInstall();

// start app
const app = async () => {
    const projectsRendered = await projectsView.render();
    clearView();
    main.append(projectsRendered);

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

// esbuild check before start app
if (!esbuildInstall) {
    const esbuildInstall = new EsbuildInstall();
    esbuildInstall.onComplete = app;
    main.append(esbuildInstall.render());
    esbuildInstall.install();
} else {
    await app();
}
