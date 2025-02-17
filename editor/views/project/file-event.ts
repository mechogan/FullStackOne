export enum FileEventType {
    UNKNOWN = 0,
    CREATED = 1,
    MODIFIED = 2,
    RENAME = 3,
    DELETED = 4
}

export type FileEvent = {
    isFile: boolean;
    origin: string;
    paths: string[];
    type: FileEventType;
};
