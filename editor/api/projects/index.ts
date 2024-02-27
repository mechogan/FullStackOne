import type { fs as globalFS } from "../../../src/api";

import config from "../config";
import { CONFIG_TYPE } from "../config/types";
import { mingleAPI, mingleWebview } from "./mingle";
import { scan } from "./scan";
import { Project } from "./types";

declare var fs: typeof globalFS;
declare var run: (
    projectdir: string,
    assetdir: string,
    entrypointData: string,
    hasErrors: boolean,
) => void;
declare var buildWebview: (entrypoint: string, outdir: string) => boolean;
declare var zip: (projectdir: string, items: string[], to: string) => void;
declare var unzip: (to: string, zipData: number[] | Uint8Array) => void;

const list = () => config.load(CONFIG_TYPE.PROJECTS) || [];
const create = (project: Omit<Project, "createdDate">) => {
    const projects = list();
    const newProject = {
        ...project,
        createdDate: Date.now(),
    };
    projects.push(newProject);
    config.save(CONFIG_TYPE.PROJECTS, projects);
    fs.mkdir(project.location);
    return newProject;
};
const deleteProject = (project: Project) => {
    const projects = list();
    const indexOf = projects.findIndex(
        ({ location }) => location === project.location,
    );
    projects.splice(indexOf, 1);
    config.save(CONFIG_TYPE.PROJECTS, projects);
    fs.rm(project.location);
};

export default {
    list,
    create,
    delete: deleteProject,
    run(project: Project) {
        const maybeWebviewJS = project.location + "/index.js";
        let hasErrors = false;
        if (fs.exists(maybeWebviewJS)) {
            const entrypointWebview = mingleWebview(maybeWebviewJS);
            hasErrors = !buildWebview(
                entrypointWebview,
                project.location + "/.build",
            );
            fs.rm(entrypointWebview);
        }

        const entrypointAPI = mingleAPI(project.location + "/api/index.js");
        run(project.location, "", entrypointAPI, hasErrors);
        fs.rm(entrypointAPI);
    },
    zip(project: Project) {
        const out = project.location + "/" + project.title + ".zip";

        if (fs.exists(out)) {
            fs.rm(out);
        }

        const items = scan(project.location)
            // filter out data items and build items
            .filter(
                (item) =>
                    !item.startsWith(project.location + "/data") &&
                    !item.startsWith(project.location + "/.build"),
            )
            // convert to relative path to project.location
            .map((item) => item.slice(project.location.length + 1));

        zip(project.location, items, out);
    },
    import(
        project: Omit<Project, "createdDate">,
        zipData: number[] | Uint8Array,
    ) {
        const newProject = {
            ...project,
            createdDate: Date.now(),
        };

        if (fs.exists(project.location)) deleteProject(newProject);

        create(newProject);
        unzip(project.location, zipData);

        return newProject;
    },
};
