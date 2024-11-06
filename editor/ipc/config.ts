import { ipc } from "../../src/ipc";
import { serializeArgs } from "../../src/serialization";
import { CONFIG_DATA_TYPE, CONFIG_TYPE, Connectivity, GitAuths, Project } from "../types";




export const config = {
    get,
    save
}

function get<T extends CONFIG_TYPE>(configType: T) : Promise<CONFIG_DATA_TYPE[T]> {
    const payload = new Uint8Array([
        12,
        ...serializeArgs([configType])
    ]);

    const transformer = ([string]) => JSON.parse(string)

    return ipc.bridge(payload, transformer);
}

function save<T extends CONFIG_TYPE>(configType: T, configData: CONFIG_DATA_TYPE[T]) : Promise<boolean> {
    const payload = new Uint8Array([
        13,
        ...serializeArgs([configType, JSON.stringify(configData)])
    ]);

    return ipc.bridge(payload, ([success]) => success);
}