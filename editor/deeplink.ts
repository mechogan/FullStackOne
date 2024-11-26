import { ipcEditor } from "./ipc";
import { Store } from "./store";
import { CONFIG_TYPE, Project as ProjectType } from "./types";
import { CloneGit } from "./views/add-project/clone-git";
import { Project } from "./views/project";

// fullstacked://http//github.....git
export async function deeplink(fullstackedUrl: string) {
    console.log(fullstackedUrl);

    let url = fullstackedUrl.slice("fullstacked://".length);

    const [protocol, ...rest] = url.split("//");
    const [hostAndPath, queryString] = rest.join("//").split("?");
    url = protocol + (protocol.endsWith(":") ? "" : ":") + "//" + hostAndPath;

    const runProjectIfFound = (projects: ProjectType[]) => {
        const existingProject = projects?.find(
            (p) => p.gitRepository?.url === url
        );
        if (existingProject) {
            Project(existingProject, true);
            Store.projects.list.unsubscribe(runProjectIfFound);
            return true;
        }

        return false;
    };

    const { projects } = await ipcEditor.config.get(CONFIG_TYPE.PROJECTS);

    if (runProjectIfFound(projects)) return;

    Store.projects.list.subscribe(runProjectIfFound);
    CloneGit(url);
}
