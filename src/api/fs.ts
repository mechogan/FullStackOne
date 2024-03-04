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
};

export type Dirent = {
    name: string;
    isDirectory: boolean;
};

export declare var fs: {
    readFile(
        path: string,
        options?: { encoding?: string; absolutePath?: boolean }
    ): Promise<string | Uint8Array>;

    writeFile(file: string, data: string | Uint8Array): Promise<void>;

    unlink(path: string): Promise<void>;

    readdir(
        path: string,
        options?: { withFileTypes: boolean }
    ): Promise<string[] | Dirent[]>;

    mkdir(path: string): Promise<void>;

    rmdir(path: string): Promise<void>;

    stat(path: string): Promise<Stat>;
    lstat(path: string): Promise<Stat>;

    readlink(path: string): Promise<string>;
    symlink(path: string): Promise<void>;

    chmod(path: string, uid: number, gid: number): Promise<void>;

    exists(
        path: string,
        options?: { absolutePath?: boolean }
    ): Promise<boolean>;
    isFile(
        path: string,
        options?: { absolutePath?: boolean }
    ): Promise<boolean>;
    isDirectory(
        path: string,
        options?: { absolutePath?: boolean }
    ): Promise<boolean>;
};
