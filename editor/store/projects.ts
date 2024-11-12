import { createSubscribable } from ".";
import { CONFIG_TYPE, Project } from "../types";
import { ipcEditor } from "./ipc";

const list = createSubscribable(listP, []);
const filterValue = createSubscribable(() => filterP);

export const projects = {
    list: list.subscription,
    create,
    update,
    deleteP,
    filter: {
        value: filterValue.subscription,
        set: setFilter
    }
};

async function listP() {
    const { projects } = await ipcEditor.config.get(CONFIG_TYPE.PROJECTS);
    return projects || [];
}

let filterP = "";
function setFilter(value: string) {
    filterP = value;
    filterValue.notify();
}

async function create(project: Omit<Project, "createdDate">) {
    const newProject: Project = {
        ...project,
        createdDate: Date.now()
    };
    const projects = await listP();
    projects.push(newProject);
    await ipcEditor.config.save(CONFIG_TYPE.PROJECTS, { projects });
    list.notify();
}

async function update(project: Project, updatedProject: Project) {
    const projects = await listP();
    const indexOf = projects.findIndex(({id}) => id === project.id);
    if(indexOf === -1) return;

    if(project.id != updatedProject.id) {
        await ipcEditor.fs.rename(project.id, updatedProject.id);
    }

    projects[indexOf] = updatedProject;
    await ipcEditor.config.save(CONFIG_TYPE.PROJECTS, { projects });
    list.notify();
}

async function deleteP(project: Project) {
    const projects = await listP();
    const indexOf = projects.findIndex(({ id }) => id === project.id);
    if (indexOf === -1) return;
    projects.splice(indexOf, 1);
    await ipcEditor.config.save(CONFIG_TYPE.PROJECTS, { projects });
    list.notify();

    ipcEditor.fs.rmdir(project.id);
}
