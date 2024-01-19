import "./index.scss";
import { ProjectNew } from "./views/project-new";
import { Projects } from './views/projects';

const main = document.querySelector("main") as HTMLElement;
const clearView = () => Array.from(main.children).forEach(e => e.remove());


const projectsView = new Projects();
projectsView.newProjectAction = async () => {
    clearView();
    main.append(await projectNewView.render());
}

const projectNewView = new ProjectNew();
projectNewView.cancelAction = async () => {
    clearView();
    main.append(await projectsView.render());
}


main.append(await projectsView.render());