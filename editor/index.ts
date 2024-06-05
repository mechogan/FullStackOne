import "./index.css";

import { Project } from "./views/project";
import { ProjectNew } from "./views/project-new";
import { Projects } from "./views/projects";
import { EsbuildInstall } from "./views/esbuild";
import { GitAuth } from "./views/git-auth";
import { Settings } from "./views/settings";
import api from "./api";
import rpc from "./rpc";
import { Peers } from "./views/peers";

/// utils ///
const main = document.querySelector("main") as HTMLElement;
const clearView = () => Array.from(main.children).forEach((e) => e.remove());

/// Git Auth View ///
new GitAuth();

/// Peers View ///
const peersView = new Peers();
peersView.backAction = async () => {
    clearView();
    main.append(await projectsView.render());
};

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
projectsView.goToPeers = async () => {
    clearView();
    main.append(await peersView.render());
};

/// Settings View ///
const settings = new Settings();
settings.goToPackages = async () => {
    clearView();
    projectView.setProject({
        title: "Packages",
        location: await rpc().directories.nodeModules(),
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
(window as any).onPush["launchURL"] = async (deeplink: string) => {
    const project = await api.getProjectFromDeepLink(deeplink);
    projectView.setProject(project);
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
await api.config.init();
const esbuildInstall = await rpc().esbuild.check();

// start app
const app = async () => {
    // init connectivity
    await api.connectivity.init();

    const projectsRendered = await projectsView.render();
    clearView();
    main.append(projectsRendered);

    // for test puposes
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("demo")) {
        const demoProject = (await api.projects.list()).find(
            ({ title }) => title === "Demo"
        );
        if (demoProject) {
            projectView.setProject(demoProject);
            clearView();
            main.append(await projectView.render());
            await projectView.runProject();
        }
    }
};

// esbuild check before start app
if (!esbuildInstall) {
    const esbuildInstall = new EsbuildInstall();
    esbuildInstall.onComplete = app;
    main.append(esbuildInstall.render());
    rpc().esbuild.install();
} else {
    await app();
}
