import rpc from "../../rpc";
import git from "../git";
import projects from "../projects";
import { Project, GitAuths, Connectivity } from "../config/types";
import { CONFIG_TYPE } from "./types";

type DATA_TYPE = {
    [CONFIG_TYPE.PROJECTS]: Project[];
    [CONFIG_TYPE.GIT]: GitAuths;
    [CONFIG_TYPE.CONNECTIVITY]: Connectivity;
};

export default {
    async init() {
        const configDir = await rpc().directories.configDirectory();

        if (await rpc().fs.exists(configDir, { absolutePath: true })) return;

        await rpc().fs.mkdir(configDir, { absolutePath: true });
        const project = await projects.import(
            {
                title: "Demo",
                location: "fullstackedorg/editor-sample-demo",
                gitRepository: {
                    url: "https://github.com/fullstackedorg/editor-sample-demo.git"
                }
            },
            (await rpc().fs.readFile("Demo.zip")) as Uint8Array
        );
        await git.init(project);
    },
    async load<T extends CONFIG_TYPE>(type: T): Promise<DATA_TYPE[T] | null> {
        const configDir = await rpc().directories.configDirectory();
        const configFile = configDir + "/" + type + ".json";
        if (
            (await rpc().fs.exists(configFile, { absolutePath: true }))?.isFile
        ) {
            return JSON.parse(
                (await rpc().fs.readFile(configFile, {
                    encoding: "utf8",
                    absolutePath: true
                })) as string
            );
        }

        return null;
    },
    async save<T extends CONFIG_TYPE>(type: T, data: DATA_TYPE[T]) {
        const configDir = await rpc().directories.configDirectory();
        const configFile = configDir + "/" + type + ".json";
        rpc().fs.writeFile(configFile, JSON.stringify(data, null, 2), {
            absolutePath: true
        });
    }
};
