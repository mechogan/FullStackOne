import config from "../config";
import { CONFIG_TYPE } from "../config/types";
import { Project } from "../config/types";
import rpc from "../../rpc";
import * as zip from "@zip.js/zip.js";
import zipDirectory from "./zip";
import * as sass from "sass";
import type esbuild from "esbuild";
import slugify from "slugify";

const list = async () => {
    const projects = (await config.load(CONFIG_TYPE.PROJECTS)) || [];

    // MIGRATION 2024-07-18 : add project ID
    let save = false;
    for (const project of projects) {
        if (project.id) continue;

        save = true;
        project.id =
            project?.gitRepository?.url ===
            "https://github.com/fullstackedorg/editor-sample-demo.git"
                ? "org.fullstacked.demo"
                : slugify(project.title.replace(/\//g, "."), { lower: true });
    }
    if (save) await config.save(CONFIG_TYPE.PROJECTS, projects);
    // END

    return projects;
};
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
    async export(project: Project) {
        const zipFilename = project.title.replace(/\//, "-") + ".zip";
        const out = project.location + "/" + zipFilename;

        if (await rpc().fs.exists(out)) {
            await rpc().fs.unlink(out);
        }

        const zipData = await zipDirectory(
            project.location,
            (file) => rpc().fs.readFile(file, { absolutePath: true }),
            (path) =>
                rpc().fs.readdir(path, {
                    withFileTypes: true,
                    absolutePath: true
                }),
            (file) =>
                file.startsWith(".git") ||
                file.startsWith(".build") ||
                file.startsWith("data") ||
                file.endsWith(zipFilename + ".zip")
        );

        await rpc().fs.writeFile(out, zipData, { absolutePath: true });

        return zipData;
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
    },
    async build(project: Project) {
        const [css, js] = await Promise.all([
            buildCSS(project),
            buildJS(project)
        ]);
        const errors: Partial<esbuild.Message>[] = js || [];
        if (css) {
            errors.push(css);
        }
        return errors;
    }
};

async function buildJS(project: Project) {
    const rootDirectory = await rpc().directories.rootDirectory();

    const possibleEntrypoint = [
        "index.js",
        "index.jsx",
        "index.ts",
        "index.tsx"
    ];

    let entryPoint: string;
    for (const maybeEntrypoint of possibleEntrypoint) {
        const filePath = `${project.location}/${maybeEntrypoint}`;
        if (await rpc().fs.exists(filePath, { absolutePath: true })) {
            entryPoint = `${rootDirectory ? rootDirectory + "/" : ""}${filePath}`;
            break;
        }
    }

    if (!entryPoint) return;

    const baseJS = await getBaseJS();
    const mergedContent = `${baseJS}\nimport("${entryPoint.split("\\").join("/")}");`;
    const tmpFileName = `tmp-${Date.now()}.js`;
    const tmpFile = await rpc().esbuild.tmpFile.write(
        tmpFileName,
        mergedContent
    );

    const outdir = rootDirectory + "/" + project.location + "/.build";
    const buildErrors = await rpc().esbuild.build(tmpFile, outdir);

    await rpc().esbuild.tmpFile.unlink(tmpFileName);

    return buildErrors === 1 ? null : buildErrors.map(uncapitalizeKeys);
}

async function buildCSS(project: Project): Promise<Partial<esbuild.Message>> {
    const possibleEntrypoint = ["index.sass", "index.scss"];

    let entryPoint: string;
    for (const maybeEntrypoint of possibleEntrypoint) {
        const filePath = `${project.location}/${maybeEntrypoint}`;
        if (await rpc().fs.exists(filePath, { absolutePath: true })) {
            entryPoint = filePath;
            break;
        }
    }

    if (!entryPoint) return;

    const content = (await rpc().fs.readFile(entryPoint, {
        absolutePath: true,
        encoding: "utf8"
    })) as string;
    let result: sass.CompileResult;
    try {
        result = await sass.compileStringAsync(content, {
            importer: {
                load: async (url) => {
                    const filePath = `${project.location}${url.pathname}`;
                    const contents = (await rpc().fs.readFile(filePath, {
                        absolutePath: true,
                        encoding: "utf8"
                    })) as string;
                    return {
                        syntax: filePath.endsWith(".sass")
                            ? "indented"
                            : filePath.endsWith(".scss")
                              ? "scss"
                              : "css",
                        contents
                    };
                },
                canonicalize: (path) => new URL(path, window.location.href)
            }
        });
    } catch (e) {
        const error = e as unknown as sass.Exception;
        const file = error.span.url?.pathname || entryPoint;
        const line = error.span.start.line + 1;
        const column = error.span.start.column;
        const length = error.span.text.length;
        return {
            text: error.message,
            location: {
                file,
                line,
                column,
                length,
                namespace: "SASS",
                lineText: error.message,
                suggestion: ""
            }
        };
    }

    const buildDirectory = `${project.location}/.build`;
    if (!(await rpc().fs.exists(buildDirectory, { absolutePath: true }))) {
        await rpc().fs.mkdir(buildDirectory, { absolutePath: true });
    }

    await rpc().fs.writeFile(buildDirectory + "/index.css", result.css, {
        absolutePath: true,
        encoding: "utf8"
    });
}

async function unzip(to: string, zipData: Uint8Array) {
    const entries = await new zip.ZipReader(
        new zip.Uint8ArrayReader(zipData)
    ).getEntries();
    if (entries && entries.length) {
        for (const entry of entries) {
            const pathComponents = entry.filename.split("/");
            const filename = pathComponents.pop();
            const directory = pathComponents.join("/");
            await rpc().fs.mkdir(to + "/" + directory, { absolutePath: true });
            const data = await entry.getData(new zip.Uint8ArrayWriter());
            await rpc().fs.writeFile(
                to + "/" + directory + "/" + filename,
                data,
                { absolutePath: true }
            );
        }
    }
}

let baseJSCache: string;
async function getBaseJS() {
    if (!baseJSCache) {
        baseJSCache = await rpc().esbuild.baseJS();
    }

    return baseJSCache;
}

function isPlainObject(input: any) {
    return input && !Array.isArray(input) && typeof input === "object";
}

function uncapitalizeKeys<T>(obj: T) {
    const final = {};
    for (const [key, value] of Object.entries(obj)) {
        final[key.at(0).toLowerCase() + key.slice(1)] = isPlainObject(value)
            ? uncapitalizeKeys(value)
            : value;
    }
    return final as T;
}
