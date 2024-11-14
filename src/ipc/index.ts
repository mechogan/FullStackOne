import { ipcMethods } from "../fullstacked";
import { fs } from "./fs";

export const ipc = {
    bridge: null as (
        payload: Uint8Array,
        transformer?: (responseArgs: any[]) => any
    ) => any,
    methods: {
        fs
        // fetch: () => any
        // broadcast: () => null
    } as ipcMethods
};
