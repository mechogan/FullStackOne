import "./index.css";

import { Project } from "./views/project";
import { ProjectNew } from "./views/project-new";
import { Projects } from "./views/projects";

import type typeRPC from "../../src/webview";
import type api from "../api";
import { EsbuildInstall } from "./views/esbuild";
declare var rpc: typeof typeRPC<typeof api>;

const main = document.querySelector("main") as HTMLElement;
const clearView = () => Array.from(main.children).forEach((e) => e.remove());

await rpc().config.init();
const esbuildInstall = await rpc().esbuild.checkInstall();

const app = async () => {
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
    projectsView.goToPackages = async () => {
        clearView();
        projectView.packagesView = true;
        projectView.setProject({
            title: "Packages",
            location: await rpc().packages.directory(),
            createdDate: null
        });

        main.append(await projectView.render());
    }

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

    const projectView = new Project();
    projectView.backAction = async () => {
        clearView();
        main.append(await projectsView.render());
    };

    clearView();
    main.append(await projectsView.render());
};

if (!esbuildInstall) {
    const esbuildInstall = new EsbuildInstall();
    esbuildInstall.onComplete = app;
    main.append(esbuildInstall.render());
    esbuildInstall.install();
} else {
    await app();
}
