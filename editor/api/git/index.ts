import git from "isomorphic-git";
import type { fs as globalFS } from "../../../src/api/fs";
import type { fetch as globalFetch } from "../../../src/api/fetch";
import { Buffer as globalBuffer } from "buffer";
import { Project } from "../projects/types";
import URL from "url-parse"
import config from "../config";
import { CONFIG_TYPE } from "../config/types";

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

function parseChangesMatrix(changesMatrix: Awaited<ReturnType<typeof git.statusMatrix>>) {
    let changes = {
        "added": [],
        "modified": [],
        "deleted": []
    };

    // https://isomorphic-git.org/docs/en/statusMatrix
    changesMatrix.forEach(item => {
        const path = item[0];
        if (item[1] === 0) {
            changes["added"].push(path);
        } else {
            if(item[2] === 2) {
                changes["modified"].push(path);
            } else if(item[2] === 0) {
                changes["deleted"].push(path);
            }
        }
    });

    return changes;
}

async function getParsedChanges(project: Project) {
    return parseChangesMatrix(await git.statusMatrix({
        fs,
        dir: project.location
    }))
}

// hostname => onAuthPromises
const gitAuthPromiseResolveCallbacks = new Map<string, ((auth: {username: string, password: string}) => void)[]>()

const requestGitAuth = async (url: string) => {
    const { hostname } = new URL(url);
    const gitAuths = (await config.load(CONFIG_TYPE.GIT)) || {};
    if(gitAuths?.[hostname]){
        return gitAuths?.[hostname];
    }
    
    const auth = await new Promise<{username: string, password: string}>(resolve => {
        gitAuthPromiseResolveCallbacks.set(hostname, [resolve]);
        push("gitAuth", JSON.stringify({ hostname }));
    });

    gitAuths[hostname] = auth;
    await config.save(CONFIG_TYPE.GIT, gitAuths);

    return auth;
}

export default {
    auth(hostname: string, username: string, password: string){
        const gitAuthPromiseResolves = gitAuthPromiseResolveCallbacks.get(hostname);
        if(!gitAuthPromiseResolves)
            return;

        gitAuthPromiseResolves.forEach(resolver => resolver({ username, password }));
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
        })
    },
    changes(project: Project) {
        return getParsedChanges(project)
    },
    async push(project: Project, commitMessage: string){
        const changes = await getParsedChanges(project);
        await git.add({
            fs,
            dir: project.location,
            filepath: Object.values(changes).flat()
        });
        await git.commit({
            fs,
            dir: project.location,
            message: commitMessage
        });
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
    }
};
