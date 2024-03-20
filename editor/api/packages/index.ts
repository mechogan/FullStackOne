import install, { nodeModulesDir } from "./install";
import type { fs as globalFS } from "../../../src/adapter/fs";


export default {
    install,
    directory: () => nodeModulesDir,
    async count() {
        if (!(await fs.exists(nodeModulesDir))) return 0;

        return (await fs.readdir(nodeModulesDir)).length;
    }
};
