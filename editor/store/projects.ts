import { createSubscribable } from ".";
import { CONFIG_TYPE, Project } from "../types";
import fs from "../../lib/fs";
import config from "../lib/config";

const list = createSubscribable(listP, []);

export const projects = {
    list: list.subscription,
    create,
    update,
    deleteP
};

async function listP() {
    const { projects } = await config.get(CONFIG_TYPE.PROJECTS);
    return projects || [];
}

async function create(project: Omit<Project, "createdDate">) {
    const newProject: Project = {
        ...project,
        createdDate: Date.now()
    };
    const projects = await listP();
    projects.push(newProject);
    await config.save(CONFIG_TYPE.PROJECTS, { projects });
    list.notify();
}

async function update(project: Project, updatedProject: Project) {
    const projects = await listP();
    const indexOf = projects.findIndex(({ id }) => id === project.id);
    if (indexOf === -1) return;

    if (project.id != updatedProject.id) {
        await fs.rename(project.id, updatedProject.id);
    }

    projects[indexOf] = updatedProject;
    await config.save(CONFIG_TYPE.PROJECTS, { projects });
    list.notify();
}

async function deleteP(project: Project) {
    const projects = await listP();
    const indexOf = projects.findIndex(({ id }) => id === project.id);
    if (indexOf === -1) return;
    projects.splice(indexOf, 1);
    await config.save(CONFIG_TYPE.PROJECTS, { projects });
    list.notify();

    fs.rmdir(project.id);
}
