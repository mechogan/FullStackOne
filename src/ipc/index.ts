import { ipcMethods } from "../fullstacked";
import { fs } from "./fs";
import { fetch } from "./fetch";

export const ipc = {
    bridge: null as (
        payload: Uint8Array,
        transformer?: (responseArgs: any[]) => any
    ) => any,
    methods: {
        fs,
        fetch
        // broadcast: () => null
    } as ipcMethods
};
