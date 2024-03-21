import config from "../config";
import { CONFIG_TYPE } from "../config/types";
import { scan } from "./scan";
import { Project } from "./types";
import rpc from "../../rpc";
import * as zip from "@zip.js/zip.js";

const list = async () => (await config.load(CONFIG_TYPE.PROJECTS)) || [];
const create = async (project: Omit<Project, "createdDate">) => {
    const projects = await list();
    const newProject = {
        ...project,
        createdDate: Date.now()
    };
    projects.push(newProject);
    await config.save(CONFIG_TYPE.PROJECTS, projects);
    await rpc().fs.mkdir(project.location, { absolutePath: true });
    return newProject;
};
const deleteProject = async (project: Project) => {
    const projects = await list();
    const indexOf = projects.findIndex(
        ({ location }) => location === project.location
    );
    projects.splice(indexOf, 1);
    await config.save(CONFIG_TYPE.PROJECTS, projects);
    return rpc().fs.rmdir(project.location, { absolutePath: true });
};

export default {
    list,
    create,
    async update(project: Project) {
        const projects = await list();
        const indexOf = projects.findIndex(
            ({ location }) => location === project.location
        );
        projects[indexOf] = project;
        return config.save(CONFIG_TYPE.PROJECTS, projects);
    },
    delete: deleteProject,
    async run(project: Project) {
        if(await rpc().build(project))
            return rpc().run(project);
    },
    async zip(project: Project) {
        const out = project.location + "/" + project.title + ".zip";

        if (await rpc().fs.exists(out)) {
            await rpc().fs.unlink(out);
        }

        const items = (await scan(project.location, async (...args) => rpc().fs.readdir(...args)))
            // filter out data items, build items and git directory
            .filter(
                (item) =>
                    !item.startsWith(project.location + "/data") &&
                    !item.startsWith(project.location + "/.build") &&
                    !item.startsWith(project.location + "/.git")
            )
            // convert to relative path to project.location
            .map((item) => item.slice(project.location.length + 1));

        // zip(project.location, items, out);
    },
    async import(project: Omit<Project, "createdDate">, zipData: Uint8Array) {
        const newProject = {
            ...project,
            createdDate: Date.now()
        };

        if (await rpc().fs.exists(project.location, { absolutePath: true })) {
            await deleteProject(newProject);
        }

        await create(newProject);
        await unzip(project.location, zipData);

        return newProject;
    }
};


async function unzip(to: string, zipData: Uint8Array) {
    const entries = await (new zip.ZipReader(new zip.Uint8ArrayReader(zipData))).getEntries();
    if (entries && entries.length) {
        for(const entry of entries) {
            const pathComponents = entry.filename.split("/");
            const filename = pathComponents.pop();
            const directory = pathComponents.join("/");
            await rpc().fs.mkdir(to + "/" + directory, { absolutePath: true });
            const data = await entry.getData(new zip.Uint8ArrayWriter())
            await rpc().fs.writeFile(to + "/" + directory + "/" + filename, data, { absolutePath: true } );
        }
    }
}