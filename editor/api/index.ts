import projects from "./projects";
import config from "./config";
import git from "./git";
import packages from "./packages";
import URL from "url-parse";
import SearchParams from "fast-querystring";
import rpc from "../rpc";

export default {
    projects,
    config,
    git,
    packages,
    async getProjectFromDeepLink(deeplink: string) {
        let urlStr = deeplink
            .slice("fullstacked://".length) // remove scheme in front
            .replace(/https?\/\//, (value) => value.slice(0, -2) + "://"); // add : in http(s) protocol

        const url = new URL(urlStr);

        // only handle .git url for now
        if (!url.pathname.endsWith(".git")) return;

        const gitUrl = urlStr.split("?").shift();

        let project = (await projects.list()).find(
            ({ gitRepository }) => gitRepository?.url === gitUrl
        );
        if (!project) {
            const projectDir = url.pathname
                .slice(1) // remove forward /
                .split(".")
                .shift(); // remove .git at the end;
            await rpc().fs.mkdir(projectDir, { absolutePath: true });

            await git.clone(gitUrl, projectDir);
            const usernameAndEmail =
                await git.getUsernameAndEmailForHost(gitUrl);

            const searchParams = SearchParams.parse(url.query.slice(1));
            project = await projects.create({
                location: projectDir,
                title: searchParams.title || projectDir,
                gitRepository: {
                    url: gitUrl,
                    email: usernameAndEmail?.email,
                    name: usernameAndEmail?.username
                }
            });

            if(searchParams.branch){
                await git.pull(project);
                await git.checkout(project, searchParams.branch);
            }
        }

        return project;
    }
};
