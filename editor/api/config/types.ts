import { Peer, PeerTrusted, WebAddress } from "../../../src/connectivity/types";

export enum CONFIG_TYPE {
    PROJECTS = "projects",
    GIT = "git",
    CONNECTIVITY = "connectivity"
}

export type Project = {
    title: string;
    id: string;
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
    me: Peer;
    autoConnect: boolean;
    defaultNetworkInterface: string;
    webAddreses: WebAddress[];
    peersTrusted: PeerTrusted[];
};
