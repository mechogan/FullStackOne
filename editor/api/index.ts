import projects from "./projects";
import config from "./config";
import esbuild from "./esbuild";
import git from "./git";
import packages from "./packages";
import URL from "url-parse";
import SearchParams from "fast-querystring";

import type { fs as globalFS } from "../../src/api/fs";
declare var fs: typeof globalFS;
declare var push: (messageType: string, data: string) => void;

export default {
    projects,
    fs,
    config,
    esbuild,
    git,
    packages,
    async launchURL(deeplink: string) {
        let urlStr = deeplink
            .slice("fullstacked://".length) // remove scheme in front
            .replace(/https?\/\//, (value) => value.slice(0, -2) + "://"); // add : in http(s) protocol

        const url = new URL(urlStr);

        // only handle .git url for now
        if (!url.pathname.endsWith(".git")) return;

        const gitUrl = urlStr.split("?").shift();

        let launchProject = (await projects.list()).find(
            ({ gitRepository }) => gitRepository?.url === gitUrl
        );
        if (!launchProject) {
            const projectDir = url.pathname
                .slice(1) // remove forward /
                .split(".")
                .shift(); // remove .git at the end;
            await fs.mkdir(projectDir);

            await git.clone(gitUrl, projectDir);

            const searchParams = SearchParams.parse(url.query.slice(1));
            launchProject = await projects.create({
                location: projectDir,
                title: searchParams.title || projectDir,
                gitRepository: {
                    url: gitUrl
                }
            });
        }

        push("launchURL", JSON.stringify(launchProject));
    }
};
