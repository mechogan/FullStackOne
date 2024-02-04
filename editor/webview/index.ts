import "./index.css";

import { Project } from "./views/project";
import { ProjectNew } from "./views/project-new";
import { Projects } from './views/projects';

const main = document.querySelector("main") as HTMLElement;
const clearView = () => Array.from(main.children).forEach(e => e.remove());

const projectsView = new Projects();
projectsView.newProjectAction = async () => {
    clearView();
    main.append(await projectNewView.render());
}
projectsView.selectProjectAction = async projectPath => {
    clearView();
    projectView.setProject(projectPath);
    main.append(await projectView.render());
}

const projectNewView = new ProjectNew();
projectNewView.cancelAction = async () => {
    clearView();
    main.append(await projectsView.render());
}
projectNewView.didCreateProjectAction = async newProjectPath => {
    clearView();
    projectView.setProject(newProjectPath);
    main.append(await projectView.render());
}

const projectView = new Project();
projectView.backAction = async () => {
    clearView();
    main.append(await projectsView.render());
}

main.append(await projectsView.render());