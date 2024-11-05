import { serializeArgs } from "./serialization"

export const ipc = {
    bridge: null as (payload: Uint8Array, transformer?: (responseArgs: any[]) => any) => any,
    methods: {
        fs: {
            readFile,
            writeFile
            // unlink
            // readdir
            // mkdir
            // rmdir
            // exists
            // rename
        }
        // fetch: () => any
        // broadcast: () => null
    }
}

const te = new TextEncoder();

// 2
function readFile(path: string) : Promise<Uint8Array> 
function readFile(path: string, options: { encoding: "utf8" }) : Promise<string>
function readFile(path: string, options?: { encoding: "utf8" }) : Promise<string | Uint8Array> {
    const payload = new Uint8Array([
        2,
        ...serializeArgs([path, options?.encoding === "utf8"])
    ]);

    const transformer = ([stringOrBuffer]) => stringOrBuffer

    return ipc.bridge(payload, transformer);
}

// 3
function writeFile(path: string, data: string | Uint8Array) : Promise<void> {
    if(typeof data === "string") {
        data = te.encode(data);
    }

    const payload = new Uint8Array([
        3,
        ...serializeArgs([path, data])
    ]);

    return ipc.bridge(payload)
}