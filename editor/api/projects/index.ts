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
    entrypoint: string,
    nodeModulesDir: string,
    hasErrors: boolean
) => void;
declare var buildWebview: (
    entryPoint: string,
    outdir: string,
    nodeModulesDir: string
) => boolean;
declare var zip: (projectdir: string, items: string[], to: string) => void;
declare var unzip: (to: string, zipData: Uint8Array) => void;
declare var resolvePath: (path: string) => string;

const list = async () => (await config.load(CONFIG_TYPE.PROJECTS)) || [];
const create = async (project: Omit<Project, "createdDate">) => {
    const projects = await list();
    const newProject = {
        ...project,
        createdDate: Date.now()
    };
    projects.push(newProject);
    await config.save(CONFIG_TYPE.PROJECTS, projects);
    await fs.mkdir(project.location);
    return newProject;
};
const deleteProject = async (project: Project) => {
    const projects = await list();
    const indexOf = projects.findIndex(
        ({ location }) => location === project.location
    );
    projects.splice(indexOf, 1);
    await config.save(CONFIG_TYPE.PROJECTS, projects);
    return fs.rmdir(project.location);
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
        const buildDir = project.location + "/.build";

        // clean
        if (await fs.exists(buildDir)) await fs.rmdir(buildDir);

        const maybeWebviewEntrypoints = [
            project.location + "/index.js",
            project.location + "/index.jsx"
        ];

        const existsWebviewPromises = maybeWebviewEntrypoints.map(
            (maybeWebviewJS) => fs.exists(maybeWebviewJS)
        );
        const foundWebviewEntrypointIndex = (
            await Promise.all(existsWebviewPromises)
        ).findIndex((exists) => exists);

        const foundWebviewEntrypoint =
            foundWebviewEntrypointIndex >= 0
                ? maybeWebviewEntrypoints.at(foundWebviewEntrypointIndex)
                : null;

        let hasErrors = false;
        if (foundWebviewEntrypoint) {
            const entrypointWebview = await mingleWebview(
                foundWebviewEntrypoint
            );
            hasErrors = !buildWebview(
                entrypointWebview,
                buildDir,
                resolvePath(nodeModulesDir)
            );
            await fs.unlink(entrypointWebview);
        }

        const maybeAPIEntrypoint = [
            project.location + "/api/index.js",
            project.location + "/api/index.jsx"
        ];

        const existsAPIEntrypointPromises = maybeAPIEntrypoint.map(
            (maybeWebviewJS) => fs.exists(maybeWebviewJS)
        );
        const foundAPIEntrypointIndex = (
            await Promise.all(existsAPIEntrypointPromises)
        ).findIndex((exists) => exists);

        const foundAPIEntrypoint =
            foundAPIEntrypointIndex >= 0
                ? maybeAPIEntrypoint.at(foundAPIEntrypointIndex)
                : null;

        const entrypointAPI = await mingleAPI(foundAPIEntrypoint);
        run(
            project.location,
            "",
            entrypointAPI,
            resolvePath(nodeModulesDir),
            hasErrors
        );
        await fs.unlink(entrypointAPI);
    },
    async zip(project: Project) {
        const out = project.location + "/" + project.title + ".zip";

        if (await fs.exists(out)) {
            await fs.unlink(out);
        }

        const items = (await scan(project.location))
            // filter out data items, build items and git directory
            .filter(
                (item) =>
                    !item.startsWith(project.location + "/data") &&
                    !item.startsWith(project.location + "/.build") &&
                    !item.startsWith(project.location + "/.git")
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
