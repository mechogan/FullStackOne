import type { fs as globalFS } from "../../../src/api/fs";

import config from "../config";
import { CONFIG_TYPE } from "../config/types";
import { nodeModulesDir } from "../packages/install";
import { mingleAPI, mingleWebview } from "./mingle";
import { scan } from "./scan";
import { Project } from "./types";

declare var fs: typeof globalFS;
declare var run: (
    projectdir: string,
    assetdir: string,
    entrypointData: string,
    hasErrors: boolean
) => void;
declare var buildWebview: (
    entryPoint: string,
    outdir: string,
    nodeModulesDir: string
) => boolean;
declare var zip: (projectdir: string, items: string[], to: string) => void;
declare var unzip: (to: string, zipData: Uint8Array) => void;

const list = async () => (await config.load(CONFIG_TYPE.PROJECTS)) || [];
const create = async (project: Omit<Project, "createdDate">) => {
    const projects = await list();
    const newProject = {
        ...project,
        createdDate: Date.now()
    };
    projects.push(newProject);
    config.save(CONFIG_TYPE.PROJECTS, projects);
    fs.mkdir(project.location);
    return newProject;
};
const deleteProject = async (project: Project) => {
    const projects = await list();
    const indexOf = projects.findIndex(
        ({ location }) => location === project.location
    );
    projects.splice(indexOf, 1);
    config.save(CONFIG_TYPE.PROJECTS, projects);
    return fs.rmdir(project.location);
};

export default {
    list,
    create,
    delete: deleteProject,
    async run(project: Project) {
        const maybeWebviewJS = project.location + "/index.js";
        let hasErrors = false;

        if (await fs.exists(maybeWebviewJS)) {
            const entrypointWebview = await mingleWebview(maybeWebviewJS);
            hasErrors = !buildWebview(
                entrypointWebview,
                project.location + "/.build",
                nodeModulesDir
            );
            await fs.unlink(entrypointWebview);
        }

        const entrypointAPI = await mingleAPI(
            project.location + "/api/index.js"
        );
        run(project.location, "", entrypointAPI, hasErrors);
        await fs.unlink(entrypointAPI);
    },
    async zip(project: Project) {
        const out = project.location + "/" + project.title + ".zip";

        if (await fs.exists(out)) {
            await fs.unlink(out);
        }

        const items = (await scan(project.location))
            // filter out data items and build items
            .filter(
                (item) =>
                    !item.startsWith(project.location + "/data") &&
                    !item.startsWith(project.location + "/.build")
            )
            // convert to relative path to project.location
            .map((item) => item.slice(project.location.length + 1));

        zip(project.location, items, out);
    },
    async import(project: Omit<Project, "createdDate">, zipData: Uint8Array) {
        const newProject = {
            ...project,
            createdDate: Date.now()
        };

        if (await fs.exists(project.location)) {
            await deleteProject(newProject);
        }

        create(newProject);
        unzip(project.location, zipData);

        return newProject;
    }
};
