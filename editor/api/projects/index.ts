
import type { fs as globalFS} from "../../../src/api";

import config from "../config";
import { CONFIG_TYPE } from "../config/types";
import { mingleAPI, mingleWebview } from "./mingle";
import { Project } from "./types";

declare var fs: typeof globalFS;
declare var run: (projectdir: string, assetdir: string, entrypointData: string) => void;
declare var resolvePath: (entrypoint: string) => string;
declare var buildWebview: (entrypoint: string, outdir: string) => void;

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
        fs.rm(project.location);
    },
    run(project: Project){
        const maybeWebviewJS = project.location + "/webview/index.js";
        if(fs.exists(maybeWebviewJS)){
            const entrypointWebview = mingleWebview(maybeWebviewJS);
            buildWebview(resolvePath(entrypointWebview), resolvePath(project.location + "/.build/webview"));
            fs.rm(entrypointWebview);
        }

        const entrypointAPI = mingleAPI(project.location + "/index.js");
        run(project.location, "", entrypointAPI);
        fs.rm(entrypointAPI);
    }
}