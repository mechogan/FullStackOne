import rpc from "../../rpc";

export default {
    async count() {
        const nodeModulesDirectory = await rpc().directories.nodeModulesDirectory();
        if (
            !(await rpc().fs.exists(nodeModulesDirectory, {
                absolutePath: true
            }))
        )
            return 0;
        return (
            await rpc().fs.readdir(nodeModulesDirectory, {
                withFileTypes: false,
                absolutePath: true
            })
        ).length;
    }
};
