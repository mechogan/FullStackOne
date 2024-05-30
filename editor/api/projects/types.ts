import type { PeerTrusted } from "../../../src/adapter/connectivity";

export type Project = {
    title: string;
    createdDate: number;
    location: string;
    gitRepository?: {
        url: string;
        name?: string;
        email?: string;
        merging?: string;
    };
};

export type GitAuths = {
    [hostname: string]: {
        username: string;
        password?: string;
        email?: string;
    };
};


export type Connectivity = {
    me: string,
    peersTrusted: PeerTrusted[]
}