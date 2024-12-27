import { bridge } from "../../../lib/bridge";
import { serializeArgs } from "../../../lib/bridge/serialization";
import { CONFIG_DATA_TYPE, CONFIG_TYPE } from "../../types";

export function get<T extends CONFIG_TYPE>(
    configType: T,
    checkExists: boolean = false
): Promise<CONFIG_DATA_TYPE[T]> {
    const payload = new Uint8Array([50, ...serializeArgs([configType])]);

    const transformer = ([string]) => {
        if (!string) {
            return checkExists ? null : {};
        }

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
