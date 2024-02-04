
import type { fs as globalFS} from "../../../src/api";

import { Project } from "../projects/types";
import { CONFIG_TYPE } from "./types";

declare var fs: typeof globalFS;

const configdir = ".config/fullstacked";

if(!fs.exists(configdir))
    fs.mkdir(configdir);

type DATA_TYPE = {
    [CONFIG_TYPE.PROJECTS]: Project[]
}

export default {
    load<T extends CONFIG_TYPE>(type: T) : DATA_TYPE[T] | null {
        const configFile = configdir + "/" + type + ".json";
        if(fs.exists(configFile))
            return JSON.parse(fs.readfileUTF8(configFile));

        return null;
    },
    save<T extends CONFIG_TYPE>(type: T, data: DATA_TYPE[T]) {
        const configFile = configdir + "/" + type + ".json";
        fs.putfileUTF8(configFile, JSON.stringify(data, null, 2));
    }
}