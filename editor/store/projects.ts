import { createSequential, createSubscribable, Store } from ".";
import { CONFIG_TYPE, Project } from "../types";
import fs from "../../lib/fs";
import config from "../lib/config";
import { SnackBar } from "../../lib/components/snackbar";
import core_open from "../lib/core_open";
import { buildSASS } from "../lib/esbuild/sass";
import esbuild from "../lib/esbuild";
import { isModuleResolveError } from "../packages";
import git from "../lib/git";
import platform, { Platform } from "../../lib/platform";

const list = createSubscribable(listP, []);

const activeProjectBuilds = new Set<string>();
const builds = createSubscribable(() => activeProjectBuilds);

const activeProjectPulls = new Set<string>();
const pulls = createSubscribable(() => activeProjectPulls);

export const projects = {
    list: list.subscription,
    create: createSequential(create),
    update,
    deleteP,

    build,
    builds: builds.subscription,

    pull,
    pulls: pulls.subscription
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

    return newProject;
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

const buildHashFile = ".build/.commit";

async function build(project: Project) {
    Store.editor.codeEditor.clearAllBuildErrors();

    activeProjectBuilds.add(project.id);
    builds.notify();

    const removeProjectBuild = () => {
        activeProjectBuilds.delete(project.id);
        builds.notify();
    };

    let isUserMode = false;
    const setUM = (um: boolean) => (isUserMode = um);
    Store.preferences.isUserMode.subscribe(setUM);

    if (isUserMode && project.gitRepository?.url) {
        const head = await git.head(project.id);
        const lastBuildHash = await fs.readFile(
            `${project.id}/${buildHashFile}`,
            { encoding: "utf8" }
        );
        if (lastBuildHash === head.Hash) {
            core_open(project.id);
            removeProjectBuild();
            return;
        }
    }

    try {
        const rawErrors = await coreBuild(project);

        const buildErrors = rawErrors.map((error) => {
            return {
                file: error.location?.file,
                line: error.location?.line,
                col: error.location?.column,
                length: error.location?.length,
                message: error.text
            };
        });

        if (buildErrors.length) {
            const nonModuleRelatedErrors = buildErrors.filter(
                (e) =>
                    !isModuleResolveError(e) &&
                    !(
                        platform === Platform.WASM &&
                        e.message.endsWith("not implemented on js")
                    )
            );

            if (isUserMode && nonModuleRelatedErrors.length) {
                SnackBar({
                    message: `Encountered errors while building <b>${project.title}</b>.`,
                    autoDismissTimeout: 4000
                });
            }

            buildErrors.forEach(Store.editor.codeEditor.addBuildError);

            if (nonModuleRelatedErrors.length === 0) {
                Store.preferences.isUserMode.unsubscribe(setUM);

                return new Promise((resolve) => {
                    const waitForModulesInstallation = (
                        packageInstallation: Map<string, any>
                    ) => {
                        if (packageInstallation.size === 0) {
                            Store.packages.installingPackages.unsubscribe(
                                waitForModulesInstallation
                            );
                            resolve(build(project));
                        }
                    };

                    Store.packages.installingPackages.subscribe(
                        waitForModulesInstallation
                    );
                });
            }
        } else {
            if (project.gitRepository?.url) {
                const head = await git.head(project.id);
                fs.writeFile(`${project.id}/.build/.commit`, head.Hash);
            }

            core_open(project.id);
        }
    } catch (e) {
        SnackBar({
            message: `Failed to build <b>${project.title}</b>.`,
            autoDismissTimeout: 4000
        });
    }

    removeProjectBuild();
}

async function coreBuild(project: Project) {
    Store.editor.codeEditor.clearAllBuildErrors();
    const buildErrorsSASS = await buildSASS(project);
    const buildErrorsEsbuild = await esbuild.build(project);
    const buildErrors = [buildErrorsSASS, ...(buildErrorsEsbuild || [])]
        .flat()
        .filter(Boolean);
    return buildErrors;
}

async function pull(project: Project) {
    if (!project.gitRepository?.url) {
        return;
    }

    activeProjectPulls.add(project.id);
    pulls.notify();
    try {
        await git.pull(project);
    } catch (e) {
        SnackBar({
            message: `Failed to update <b>${project.title}</b>.`,
            autoDismissTimeout: 4000
        });
    }
    activeProjectPulls.delete(project.id);
    pulls.notify();
}
