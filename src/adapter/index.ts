import { fetch } from "./fetch";
import { fs } from "./fs";

export type Adapter = {
    fs: fs;
    fetch: fetch;
    platform: string;
    broadcast: (data: any) => void
};
