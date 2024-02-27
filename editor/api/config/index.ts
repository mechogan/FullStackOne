import type { fs as globalFS } from "../../../src/api";
import projects from "../projects";

import { Project } from "../projects/types";
import { CONFIG_TYPE } from "./types";

declare var fs: typeof globalFS;
declare var demoZIP: string;

const configdir = ".config/fullstacked";

type DATA_TYPE = {
    [CONFIG_TYPE.PROJECTS]: Project[];
};

export default {
    init() {
        if (fs.exists(configdir)) return;

        fs.mkdir(configdir);
        projects.import(
            { title: "Demo", location: configdir + "/Demo" },
            fs.readfile(demoZIP, true),
        );
    },
    load<T extends CONFIG_TYPE>(type: T): DATA_TYPE[T] | null {
        const configFile = configdir + "/" + type + ".json";
        if (fs.exists(configFile))
            return JSON.parse(fs.readfileUTF8(configFile));

        return null;
    },
    save<T extends CONFIG_TYPE>(type: T, data: DATA_TYPE[T]) {
        const configFile = configdir + "/" + type + ".json";
        fs.putfileUTF8(configFile, JSON.stringify(data, null, 2));
    },
};
