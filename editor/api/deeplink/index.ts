import api from "..";
import { CONFIG_TYPE } from "../config/types";
import projects from "../projects";

export default {
    getRepo(deeplink: string) {
        let urlStr = deeplink
            .slice("fullstacked://".length) // remove scheme in front
            .replace(/https?\/\//, (value) => value.slice(0, -2) + "://"); // add : in http(s) protocol

        const urlObj = new URL(urlStr);

        // only handle .git url for now
        if (!urlObj.pathname.endsWith(".git")) return;

        const url = urlStr.split("?").shift();

        const searchParams = new URLSearchParams(urlObj.search);
        const branch = searchParams.get("branch")
       
        return {
            url,
            branch
        }
    },
    async findExistingProjectWithRepoUrl(url: string){
        return (await api.config.load(CONFIG_TYPE.PROJECTS))
            .find(project => project.gitRepository?.url === url);
    }
}