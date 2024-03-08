export type Project = {
    title: string;
    createdDate: number;
    location: string;
    gitRepository?: {
        url: string;
        name?: string;
        email?: string;
    };
};

export type GitAuths = {
    [hostname: string]: {
        username: string;
        password?: string;
        email?: string;
    };
};
