import type { fs as globalFS } from "../../../src/api/fs";
import projects from "../projects";

import { Project, GitAuths } from "../projects/types";
import { CONFIG_TYPE } from "./types";

declare var fs: typeof globalFS;
declare var demoZIP: string;

export const configdir = ".config/fullstacked";

type DATA_TYPE = {
    [CONFIG_TYPE.PROJECTS]: Project[];
    [CONFIG_TYPE.GIT]: GitAuths
};

export default {
    async init() {
        try {
            await fs.stat(configdir);
            return;
        } catch (e) {}

        await fs.mkdir(configdir);
        projects.import(
            { title: "Demo", location: configdir + "/Demo" },
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
