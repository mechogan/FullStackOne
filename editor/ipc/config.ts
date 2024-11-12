import { ipc } from "../../src/ipc";
import { serializeArgs } from "../../src/serialization";
import { CONFIG_DATA_TYPE, CONFIG_TYPE } from "../types";

export const config = {
    get,
    save
};

function get<T extends CONFIG_TYPE>(
    configType: T
): Promise<CONFIG_DATA_TYPE[T]> {
    const payload = new Uint8Array([50, ...serializeArgs([configType])]);

    const transformer = ([string]) => {
        if (!string) return {};

        // MIGRATION 0.9.0 -> 0.10.0 | 08-10-2024
        // no array at json root

        let json = JSON.parse(string);
        if (configType === CONFIG_TYPE.PROJECTS && Array.isArray(json)) {
            json = {
                projects: json
            };
        }

        // END

        return json;
    };

    return ipc.bridge(payload, transformer);
}

function save<T extends CONFIG_TYPE>(
    configType: T,
    configData: CONFIG_DATA_TYPE[T]
): Promise<boolean> {
    const payload = new Uint8Array([
        51,
        ...serializeArgs([configType, JSON.stringify(configData)])
    ]);

    return ipc.bridge(payload, ([success]) => success);
}
