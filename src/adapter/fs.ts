type Stat = {
    dev: number;
    ino: number;
    mode: number;
    nlink: number;
    uid: number;
    gid: number;
    rdev: number;
    size: number;
    blksize: number;
    blocks: number;
    atimeMs: number;
    mtimeMs: number;
    ctimeMs: number;
    birthtimeMs: number;
    atime: Date;
    mtime: Date;
    ctime: Date;
    birthtime: Date;
    isDirectory: boolean;
    isFile: boolean;
};

export type Dirent = {
    name: string;
    isDirectory: boolean | (() => boolean);
};

export type fs = {
    readFile(
        path: string,
        options?: { encoding?: string; absolutePath?: boolean }
    ): Promise<string | Uint8Array>;

    writeFile(
        file: string,
        data: string | Uint8Array,
        options?: {
            encoding?: "utf8";
            absolutePath?: boolean;
            recursive?: boolean;
        }
    ): Promise<void>;

    writeFileMulti(
        options: {
            encoding?: "utf8";
            absolutePath?: boolean;
            recursive?: boolean;
        },
        ...files: (string | Uint8Array)[]
    ): Promise<void[]>;

    unlink(path: string, options?: { absolutePath?: boolean }): Promise<void>;

    readdir(
        path: string,
        options?: {
            withFileTypes?: boolean;
            absolutePath?: boolean;
            recursive?: boolean;
        }
    ): Promise<string[] | Dirent[]>;

    mkdir(path: string, options?: { absolutePath?: boolean }): Promise<void>;

    rmdir(path: string, options?: { absolutePath?: boolean }): Promise<void>;

    stat(path: string, options?: { absolutePath?: boolean }): Promise<Stat>;
    lstat(path: string, options?: { absolutePath?: boolean }): Promise<Stat>;

    readlink(
        path: string,
        options?: { absolutePath?: boolean }
    ): Promise<string>;
    symlink(path: string, options?: { absolutePath?: boolean }): Promise<void>;

    chmod(
        path: string,
        uid: number,
        gid: number,
        options?: { absolutePath?: boolean }
    ): Promise<void>;

    exists(
        path: string,
        options?: { absolutePath?: boolean }
    ): Promise<null | { isFile: boolean }>;

    rename(
        oldPath: string,
        newPath: string,
        options?: { absolutePath?: boolean }
    ): Promise<void>;
};
