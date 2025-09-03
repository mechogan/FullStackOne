import { CONFIG_DATA_TYPE, CONFIG_TYPE } from "../../editor/types";
import { bridge } from "../bridge";
import { serializeArgs } from "../bridge/serialization";

export function get<T extends CONFIG_TYPE>(
    configType: T,
    checkExists: boolean = false
): Promise<CONFIG_DATA_TYPE[T]> {
    const payload = new Uint8Array([50, ...serializeArgs([configType])]);

    const transformer = ([string]) => {
        if (!string) {
            return checkExists ? null : {};
        }

        return JSON.parse(string);
    };

    return bridge(payload, transformer);
}

export function save<T extends CONFIG_TYPE>(
    configType: T,
    configData: CONFIG_DATA_TYPE[T]
): Promise<boolean> {
    const payload = new Uint8Array([
        51,
        ...serializeArgs([configType, JSON.stringify(configData)])
    ]);

    return bridge(payload, ([success]) => success);
}
