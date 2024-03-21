import rpc from "../../rpc";
import install, { nodeModulesDir } from "./install";


export default {
    install,
    directory: () => nodeModulesDir,
    async count() {
        if (!(await rpc().fs.exists(nodeModulesDir))) return 0;

        return (await rpc().fs.readdir(nodeModulesDir)).length;
    }
};
