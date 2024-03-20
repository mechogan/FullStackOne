import projects from "../projects";

import { Project, GitAuths } from "../projects/types";
import { CONFIG_TYPE } from "./types";

export const configdir = ".config/fullstacked";

type DATA_TYPE = {
    [CONFIG_TYPE.PROJECTS]: Project[];
    [CONFIG_TYPE.GIT]: GitAuths;
};

export default {
    async init() {
        if (await fs.exists(configdir)) return;

        await fs.mkdir(configdir);
        projects.import(
            {
                title: "Demo",
                location: "fullstackedorg/editor-sample-demo"
                // TODO: uncomment when webcontainer git CORS fixed
                // gitRepository: {
                //     url: "https://github.com/fullstackedorg/editor-sample-demo.git"
                // }
            },
            (await fs.readFile(demoZIP, { absolutePath: true })) as Uint8Array
        );
    },
    async load<T extends CONFIG_TYPE>(type: T): Promise<DATA_TYPE[T] | null> {
        const configFile = configdir + "/" + type + ".json";
        try {
            await fs.stat(configFile);
            return JSON.parse(
                (await fs.readFile(configFile, { encoding: "utf8" })) as string
            );
        } catch (e) {}

        return null;
    },
    async save<T extends CONFIG_TYPE>(type: T, data: DATA_TYPE[T]) {
        const configFile = configdir + "/" + type + ".json";
        fs.writeFile(configFile, JSON.stringify(data, null, 2));
    }
};
