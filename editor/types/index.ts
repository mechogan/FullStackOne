export enum CONFIG_TYPE {
    GENERAL = "general",
    PROJECTS = "projects",
    GIT = "git",
    AGENT = "agent"
    // CONNECTIVITY = "connectivity"
}

export type CONFIG_DATA_TYPE = {
    [CONFIG_TYPE.GENERAL]: {
        userMode: boolean;
    };
    [CONFIG_TYPE.PROJECTS]: {
        projects: Project[];
    };
    [CONFIG_TYPE.GIT]: GitAuths;

    [CONFIG_TYPE.AGENT]: any;
    // [CONFIG_TYPE.CONNECTIVITY]: Connectivity;
};

export type Project = {
    title: string;
    id: string;
    createdDate: number;
    location?: string;
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

// export type Connectivity = {
//     me: Peer;
//     autoConnect: boolean;
//     defaultNetworkInterface: string;
//     webAddresses: WebAddress[];
//     peersTrusted: PeerTrusted[];
// };
