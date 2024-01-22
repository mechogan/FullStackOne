import "./index.scss";
import { rpc } from "../../rpc";
import Add from "../../assets/icons/add.svg";

export class Projects {
    newProjectAction: () => void;

    async render() {
        const container = document.createElement("div");
        container.classList.add("projects")

        const title = document.createElement("h1");
        title.innerText = "Projects";
        container.append(title);

        const projectsContainer = document.createElement("div");

        const projects = await rpc().projects.list();

        projects.forEach(project => {
            const projectPreview = document.createElement("article");
            projectsContainer.append(projectPreview);
        });

        const newProject = document.createElement("article");
        newProject.innerHTML = Add;
        newProject.addEventListener("click", this.newProjectAction)
        projectsContainer.append(newProject);

        container.append(projectsContainer);
        
        return container;
    }
}