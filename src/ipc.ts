import { CONFIG_TYPE } from "../editor/api/config/types"

export type ipc = {
    fs: {
        readFile
        writeFile
        unlink
        readdir
        mkdir
        rmdir
        exists
        rename
    }
    fetch: () => any
    broadcast: () => null
}