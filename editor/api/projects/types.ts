export type Project = {
    title: string;
    createdDate: number;
    location: string;
    gitRepository?: string;
};


export type GitAuths = {
    [hostname: string]: {
        username: string,
        password: string,
        email?: string
    }
}