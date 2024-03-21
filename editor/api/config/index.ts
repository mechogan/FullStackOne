import rpc from "../../rpc";

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
        if (await rpc().fs.exists(configdir, { absolutePath: true })) 
            return;

        await rpc().fs.mkdir(configdir, { absolutePath: true });
        await projects.import(
            {
                title: "Demo",
                location: "fullstackedorg/editor-sample-demo"
                // TODO: uncomment when webcontainer git CORS fixed
                // gitRepository: {
                //     url: "https://github.com/fullstackedorg/editor-sample-demo.git"
                // }
            },
            (await rpc().fs.readFile("Demo.zip")) as Uint8Array
        );
    },
    async load<T extends CONFIG_TYPE>(type: T): Promise<DATA_TYPE[T] | null> {
        const configFile = configdir + "/" + type + ".json";
        if((await rpc().fs.exists(configFile, { absolutePath: true }))?.isFile){
            return JSON.parse(
                (await rpc().fs.readFile(configFile, { encoding: "utf8", absolutePath: true })) as string
            );
        }

        return null;
    },
    async save<T extends CONFIG_TYPE>(type: T, data: DATA_TYPE[T]) {
        const configFile = configdir + "/" + type + ".json";
        rpc().fs.writeFile(configFile, JSON.stringify(data, null, 2), { absolutePath: true });
    }
};
