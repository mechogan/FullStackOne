import config from "../config";
import { CONFIG_TYPE } from "../config/types";
import fs from "../fs";
import { Project } from "./types";

const list = () => config.load(CONFIG_TYPE.PROJECTS) || [];

export default {
    list,
    create(project: Omit<Project, "createdDate">){
        const projects = list();
        const newProject = {
            ...project,
            createdDate: Date.now()
        }
        projects.push(newProject);
        config.save(CONFIG_TYPE.PROJECTS, projects);
        fs.mkdir(project.location);
        return newProject;
    },
    delete(project: Project){
        const projects = list();
        const indexOf = projects.findIndex(({location}) => location === project.location);
        projects.splice(indexOf, 1);
        config.save(CONFIG_TYPE.PROJECTS, projects);
        fs.deleteItem(project.location);
    }
}