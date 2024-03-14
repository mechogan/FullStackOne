import git from "isomorphic-git";
import type { fs as globalFS } from "../../../src/api/fs";
import type { fetch as globalFetch } from "../../../src/api/fetch";
import { Buffer as globalBuffer } from "buffer";
import { Project } from "../projects/types";
import URL from "url-parse";
import config from "../config";
import { CONFIG_TYPE } from "../config/types";
import github from "./github";

declare var fs: typeof globalFS;
declare var fetch: typeof globalFetch;
declare var push: (messageType: string, data: string) => void;

// for isomorphic-git
globalThis.Buffer = globalBuffer;

async function awaitBody(body: AsyncIterableIterator<Uint8Array>) {
    let size = 0;
    const buffers = [];
    for await (const chunk of body) {
        buffers.push(chunk);
        size += chunk.byteLength;
    }
    const result = new Uint8Array(size);
    let nextIndex = 0;
    for (const buffer of buffers) {
        result.set(buffer, nextIndex);
        nextIndex += buffer.byteLength;
    }
    return result;
}

// https://isomorphic-git.org/docs/en/http
const http = {
    async request({ url, method, headers, body, onProgress }) {
        body = body ? await awaitBody(body) : undefined;

        const response = await fetch(url, {
            method,
            headers,
            body
        });

        return {
            ...response,
            body: [response.body]
        };
    }
};

function parseChangesMatrix(
    changesMatrix: Awaited<ReturnType<typeof git.statusMatrix>>
) {
    let changes = {
        added: [] as string[],
        modified: [] as string[],
        deleted: [] as string[]
    };

    // https://isomorphic-git.org/docs/en/statusMatrix
    changesMatrix.forEach((item) => {
        const path = item[0];
        if (item[1] === 0) {
            changes["added"].push(path);
        } else {
            if (item[2] === 2) {
                changes["modified"].push(path);
            } else if (item[2] === 0) {
                changes["deleted"].push(path);
            }
        }
    });

    return changes;
}

async function getParsedChanges(project: Project) {
    return parseChangesMatrix(
        await git.statusMatrix({
            fs,
            dir: project.location,
            // always ignore .build and data directories
            filter: (file) =>
                !file.endsWith(".DS_Store") &&
                !file.startsWith(".build") &&
                !file.startsWith("data") &&
                file !== project.title + ".zip"
        })
    );
}

// hostname => onAuthPromises
const gitAuthPromiseResolveCallbacks = new Map<
    string,
    ((auth: { username: string; password: string }) => void)[]
>();

const requestGitAuth = async (url: string) => {
    const { hostname } = new URL(url);
    const gitAuths = (await config.load(CONFIG_TYPE.GIT)) || {};
    if (gitAuths?.[hostname]) {
        return gitAuths?.[hostname];
    }

    const auth = await new Promise<{ username: string; password: string }>(
        (resolve) => {
            gitAuthPromiseResolveCallbacks.set(hostname, [resolve]);
            push("gitAuth", JSON.stringify({ hostname }));
        }
    );

    return auth;
};

export async function auth(
    hostname: string,
    username: string,
    email: string,
    password: string
) {
    hostname = hostname.includes("://") ? new URL(hostname).hostname : hostname;

    const gitAuths = (await config.load(CONFIG_TYPE.GIT)) || {};

    // exists
    if (gitAuths?.[hostname]) {
        gitAuths[hostname] = {
            password: gitAuths[hostname].password,
            username,
            email
        };
    }
    // new
    else {
        gitAuths[hostname] = {
            username,
            email,
            password
        };
    }
    await config.save(CONFIG_TYPE.GIT, gitAuths);

    const gitAuthPromiseResolves = gitAuthPromiseResolveCallbacks.get(hostname);

    gitAuthPromiseResolves?.forEach((resolver) =>
        resolver({ username, password })
    );
}

export default {
    auth,
    async getAllAuths() {
        const gitAuths = (await config.load(CONFIG_TYPE.GIT)) || {};

        // remove passwords
        Object.entries(gitAuths).forEach(([host, auth]) => {
            const { password, ...rest } = auth;
            gitAuths[host] = rest;
        });

        return gitAuths;
    },
    async getUsernameAndEmailForHost(url: string) {
        const { hostname } = new URL(url);
        const gitAuths = (await config.load(CONFIG_TYPE.GIT)) || {};
        const gitAuth = gitAuths?.[hostname];
        if (!gitAuth) return null;

        return {
            username: gitAuth.username,
            email: gitAuth.email
        };
    },
    async deleteAuthForHost(host: string) {
        const gitAuths = (await config.load(CONFIG_TYPE.GIT)) || {};
        if (gitAuths?.[host]) delete gitAuths[host];
        return config.save(CONFIG_TYPE.GIT, gitAuths);
    },
    currentBranch(project: Project) {
        return git.currentBranch({
            fs,
            dir: project.location
        });
    },
    log(project: Project, depth: number) {
        return git.log({
            fs,
            depth,
            dir: project.location
        });
    },
    async changes(project: Project) {
        let unreacheable = false;
        try {
            await git.fetch({
                fs,
                http,
                dir: project.location,
                prune: true,
                onAuth: requestGitAuth
            });
        } catch (e) {
            // unreacheable
            if (e.cause?.code == "ENOTFOUND") {
                unreacheable = true;
            }
        }

        return {
            unreacheable,
            changes: await getParsedChanges(project)
        };
    },
    async pull(project: Project) {
        let fetch: Awaited<ReturnType<typeof git.fetch>>;
        try {
            fetch = await git.fetch({
                fs,
                http,
                dir: project.location,
                prune: true,
                onAuth: requestGitAuth
            });
        } catch (e) {
            // unreacheable
            if (e.cause?.code === "ENOTFOUND") {
                return;
            }
            console.log(e);

            return e;
        }

        const [currentBranch, remoteBranches] = await Promise.all([
            git.currentBranch({
                fs,
                dir: project.location
            }),
            git.listBranches({
                fs,
                dir: project.location,
                remote: "origin"
            })
        ]);

        // DETACHED
        if (!currentBranch || !remoteBranches.includes(currentBranch)) return;

        const pull = async () => {
            if (!project.gitRepository.name) {
                return {
                    error: "No git user.name"
                };
            }

            try {
                const response = await git.pull({
                    fs,
                    http,
                    dir: project.location,
                    singleBranch: true,
                    author: {
                        name: project.gitRepository.name,
                        email: project.gitRepository.email
                    },
                    onAuth: requestGitAuth
                });
                return response;
            } catch (e) {
                if (
                    e.code === "CheckoutConflictError" ||
                    e.code === "MergeNotSupportedError"
                ) {
                    return { error: "Conflicts", files: e.data.filepaths };
                } else if (e.code === "MergeConflictError") {
                    try {
                        await git.merge({
                            fs,
                            dir: project.location,
                            ours: currentBranch,
                            theirs: fetch.fetchHead,
                            abortOnConflict: false,
                            author: {
                                name: project.gitRepository.name,
                                email: project.gitRepository.email
                            }
                        });
                        return;
                    } catch (e) {
                        return {
                            error: "Merge",
                            files: e.data.bothModified,
                            theirs: fetch.fetchHead
                        };
                    }
                } else if (e.code === "UnmergedPathsError") {
                    return {
                        error: "Merge",
                        files: e.data.filepaths,
                        theirs: fetch.fetchHead
                    };
                }

                return e;
            }
        };

        const changes = await getParsedChanges(project);
        if (Object.values(changes).some((arr) => arr.length !== 0)) {
            return pull();
        } else {
            try {
                await git.fastForward({
                    fs,
                    http,
                    dir: project.location,
                    singleBranch: true,
                    onAuth: requestGitAuth
                });
            } catch (e) {
                if (e.code === "FastForwardError") {
                    return pull();
                }
                return e;
            }
        }
    },
    async commit(
        project: Project,
        commitMessage: string,
        merging?: {
            theirs: string;
            filepaths: string[];
        }
    ) {
        const changes = await getParsedChanges(project);

        const filepath = changes.added.concat(changes.modified);
        if (merging?.filepaths) {
            filepath.push(...merging.filepaths);
        }

        await git.add({
            fs,
            dir: project.location,
            filepath
        });

        await Promise.all(
            changes.deleted.map((filepath) =>
                git.remove({
                    fs,
                    dir: project.location,
                    filepath
                })
            )
        );

        const parent = merging?.theirs
            ? [
                  (await git.currentBranch({
                      fs,
                      dir: project.location
                  })) as string,
                  merging.theirs
              ]
            : undefined;

        return git.commit({
            fs,
            dir: project.location,
            message: commitMessage,
            author: {
                name: project.gitRepository.name,
                email: project.gitRepository.email
            },
            parent
        });
    },
    async push(project: Project) {
        return git.push({
            fs,
            http,
            dir: project.location,
            onAuth: requestGitAuth
        });
    },
    clone(url: string, dir: string) {
        return git.clone({
            fs,
            http,
            dir,
            url,
            singleBranch: true,
            depth: 1,
            onAuth: requestGitAuth
        });
    },
    checkout(project: Project, branchOrCommit: string) {
        return git.checkout({
            fs,
            dir: project.location,
            ref: branchOrCommit
        });
    },
    checkoutFile(
        project: Project,
        branchOrCommit: string,
        filepaths: string[],
        force: boolean = false
    ) {
        return git.checkout({
            fs,
            dir: project.location,
            ref: branchOrCommit,
            force,
            filepaths
        });
    },
    revertFileChanges(project: Project, files: string[]) {
        return git.checkout({
            fs,
            dir: project.location,
            filepaths: files,
            force: true
        });
    },
    branch: {
        async getAll(project: Project) {
            try {
                await git.fetch({
                    fs,
                    http,
                    dir: project.location,
                    prune: true,
                    onAuth: requestGitAuth
                });
            } catch (e) {}

            const [local, remote] = await Promise.all([
                git.listBranches({
                    fs,
                    dir: project.location
                }),
                git.listBranches({
                    fs,
                    dir: project.location,
                    remote: "origin"
                })
            ]);

            return { local, remote };
        },
        create(project: Project, branch: string) {
            return git.branch({
                fs,
                dir: project.location,
                ref: branch,
                checkout: true
            });
        },
        delete(project: Project, branch: string) {
            return git.deleteBranch({
                fs,
                dir: project.location,
                ref: branch
            });
        }
    },
    github
};
