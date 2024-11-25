import { serializeArgs } from "../../src/serialization";
import ipc from "../../src";
import { CONFIG_TYPE, Project } from "../types";
import { GitAuth } from "../views/project/git/auth";
import { ipcEditor } from ".";

export const git = {
    clone,
    head,
    status,
    pull,
    restore,
    checkout,
    fetch,
    commit,
    branches,
    push,
    branchDelete
};

type ErrorObj = {
    Error: string;
};

const errorChecker = ([error]) => {
    if (!error) return;

    let errorObj: ErrorObj;
    try {
        errorObj = JSON.parse(error);
    } catch (e) {}

    if (!errorObj) return;

    throw errorObj;
};

const getHostnameFromRepoURL = (repoUrl: string) => {
    const url = new URL(repoUrl);
    return url.hostname;
};

async function ipcCallWithAuth<T extends (...args: any) => any>(
    repoUrl: string,
    ipcCall: (username: string, password: string) => ReturnType<T>
) {
    const hostname = getHostnameFromRepoURL(repoUrl);
    const gitAuthConfigs = await ipcEditor.config.get(CONFIG_TYPE.GIT);
    const gitAuth = gitAuthConfigs?.[hostname];
    return ipcCall(gitAuth?.username, gitAuth?.password);
}

function checkForAuthRequiredOnCallback<T extends (...args: any) => any>(
    repoUrl: string,
    messageType: string,
    ipcCall: (username: string, password: string) => ReturnType<T>
) {
    const checkForAuthError = (message: string) => {
        try {
            errorChecker([message.trim()]);
        } catch (e) {
            if (e.Error?.startsWith("authentication required")) {
                const hostname = getHostnameFromRepoURL(repoUrl);
                GitAuth(hostname).then((retry) => {
                    if (retry) {
                        ipcCallWithAuth(repoUrl, ipcCall);
                    } else {
                        removeCoreMessageListener(
                            messageType,
                            checkForAuthError
                        );
                    }
                });
                return;
            }
        }

        if (message.endsWith("done")) {
            removeCoreMessageListener(messageType, checkForAuthError);
        }
    };

    addCoreMessageListener(messageType, checkForAuthError);
    ipcCallWithAuth(repoUrl, ipcCall);
}

async function checkForAuthRequiredOnResponse<T extends (...args: any) => any>(
    repoUrl: string,
    ipcCall: (username: string, password: string) => ReturnType<T>
) {
    let retry = false,
        response: ReturnType<T>;
    do {
        response = await ipcCallWithAuth(repoUrl, ipcCall);
        try {
            errorChecker([response.at(0)]);
        } catch (e) {
            if (e.Error?.startsWith("authentication required")) {
                retry = await GitAuth(getHostnameFromRepoURL(repoUrl));
            } else {
                throw e;
            }
        }
    } while (retry);

    return response;
}

// 70
async function clone(url: string, into: string): Promise<void> {
    const cloneWithAuth = (username: string, password: string) => {
        const payload = new Uint8Array([
            70,
            ...serializeArgs([into, url, username, password])
        ]);
        return ipc.bridge(payload);
    };

    checkForAuthRequiredOnCallback(url, "git-clone", cloneWithAuth);
}

// 71
function head(projectId: string): Promise<{ Name: string; Hash: string }> {
    const payload = new Uint8Array([71, ...serializeArgs([projectId])]);

    const transformer = ([headStr]) => {
        errorChecker(headStr);
        return JSON.parse(headStr);
    };

    return ipc.bridge(payload, transformer);
}

// 72
function status(projectId: string): Promise<{
    Added: string[];
    Modified: string[];
    Deleted: string[];
}> {
    const payload = new Uint8Array([72, ...serializeArgs([projectId])]);

    const transformer = ([statusStr]) => {
        errorChecker(statusStr);
        return JSON.parse(statusStr);
    };

    return ipc.bridge(payload, transformer);
}

// 73
function pull(project: Project) {
    const pullWithAuth = (username: string, password: string) => {
        const payload = new Uint8Array([
            73,
            ...serializeArgs([project.id, username, password])
        ]);
        return ipc.bridge(payload);
    };

    checkForAuthRequiredOnCallback(
        project.gitRepository.url,
        "git-pull",
        pullWithAuth
    );
}

// 74
function restore(projectId: string, files: string[]): Promise<void> {
    const payload = new Uint8Array([
        74,
        ...serializeArgs([projectId, ...files])
    ]);

    return ipc.bridge(payload, errorChecker);
}

// 75
function checkout(
    project: Project,
    branch: string,
    create: boolean
): Promise<void> {
    const checkoutWithAuth = (username: string, password: string) => {
        const payload = new Uint8Array([
            75,
            ...serializeArgs([project.id, branch, create, username, password])
        ]);

        return ipc.bridge(payload);
    };

    return checkForAuthRequiredOnResponse(
        project.gitRepository.url,
        checkoutWithAuth
    );
}

// 76
function fetch(project: Project): Promise<void> {
    const fetchWithAuth = (username: string, password: string) => {
        const payload = new Uint8Array([
            76,
            ...serializeArgs([project.id, username, password])
        ]);
        return ipc.bridge(payload);
    };

    return checkForAuthRequiredOnResponse(
        project.gitRepository.url,
        fetchWithAuth
    );
}

// 77
function commit(project: Project, commitMessage: string): Promise<void> {
    const payload = new Uint8Array([
        77,
        ...serializeArgs([
            project.id,
            commitMessage,
            project.gitRepository.name || "",
            project.gitRepository.email || ""
        ])
    ]);

    return ipc.bridge(payload, errorChecker);
}

// 78
async function branches(project: Project) {
    const branchesWithAuth = (username: string, password: string) => {
        const payload = new Uint8Array([
            78,
            ...serializeArgs([project.id, username, password])
        ]);
        return ipc.bridge(payload);
    };

    const branchesArgs = await checkForAuthRequiredOnResponse(
        project.gitRepository.url,
        branchesWithAuth
    );
    const branches: {
        name: string;
        remote: boolean;
        local: boolean;
    }[] = [];

    for (let i = 0; i < branchesArgs.length; i = i + 3) {
        branches.push({
            name: branchesArgs[i],
            remote: branchesArgs[i + 1],
            local: branchesArgs[i + 2]
        });
    }

    return branches;
}

// 79
function push(project: Project) {
    const pullWithAuth = (username: string, password: string) => {
        const payload = new Uint8Array([
            79,
            ...serializeArgs([project.id, username, password])
        ]);
        ipc.bridge(payload);
    };

    checkForAuthRequiredOnCallback(
        project.gitRepository.url,
        "git-push",
        pullWithAuth
    );
}

// 80
function branchDelete(project: Project, branch: string) {
    const payload = new Uint8Array([
        80,
        ...serializeArgs([project.id, branch])
    ]);

    return ipc.bridge(payload, errorChecker);
}
