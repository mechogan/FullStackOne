import { bridge } from "../../../lib/bridge";
import { serializeArgs } from "../../../lib/bridge/serialization";
import core_message from "../../../lib/core_message";
import { CONFIG_TYPE, Project } from "../../types";
import { GitAuth } from "../../views/project/git/auth";
import config from "../config";

type ErrorObj = {
    Error: string;
};

const errorChecker = ([maybeError]) => {
    if (!maybeError) return;

    let errorObj: ErrorObj;
    try {
        const json = JSON.parse(maybeError);
        if (json.Error) {
            errorObj = {
                Error: json.Data
            };
        }
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
    const gitAuthConfigs = await config.get(CONFIG_TYPE.GIT);
    const gitAuth = gitAuthConfigs?.[hostname];
    return ipcCall(gitAuth?.username, gitAuth?.password);
}

function checkForAuthRequiredOnCallback<T extends (...args: any) => any>(
    repoUrl: string,
    messageType: string,
    ipcCall: (username: string, password: string) => ReturnType<T>
) {
    return new Promise<void>((resolve, reject) => {
        const start = Date.now();
        const checkForAuthError = (message: string) => {
            try {
                errorChecker([message]);
            } catch (e) {
                if (e.Error?.startsWith("authentication required")) {
                    const hostname = getHostnameFromRepoURL(repoUrl);
                    GitAuth(hostname).then((retry) => {
                        if (retry) {
                            ipcCallWithAuth(repoUrl, ipcCall);
                        } else {
                            reject(e.Error);
                            core_message.removeListener(
                                messageType,
                                checkForAuthError
                            );
                        }
                    });
                    return;
                } else if (e.Error) {
                    reject(e.Error);
                    return;
                }
            }

            const { Url, Data } = JSON.parse(message);
            if (Url !== repoUrl) return;

            if (Data.endsWith("done")) {
                console.log("DONE IN", Date.now() - start, "ms");
                resolve();
                core_message.removeListener(messageType, checkForAuthError);
            }
        };

        core_message.addListener(messageType, checkForAuthError);
        ipcCallWithAuth(repoUrl, ipcCall);
    });
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
            errorChecker(response);
        } catch (e) {
            if (e.Error?.startsWith("authentication required")) {
                retry = await GitAuth(getHostnameFromRepoURL(repoUrl));
            } else {
                throw e.Error;
            }
        }
    } while (retry);

    return response;
}

// 70
export function clone(url: string, into: string) {
    const cloneWithAuth = (username: string, password: string) => {
        const payload = new Uint8Array([
            70,
            ...serializeArgs([into, url, username, password])
        ]);
        return bridge(payload);
    };

    checkForAuthRequiredOnCallback(url, "git-clone", cloneWithAuth);
}

// 71
export function head(
    projectId: string
): Promise<{ Name: string; Hash: string }> {
    const payload = new Uint8Array([71, ...serializeArgs([projectId])]);

    const transformer = ([headStr]) => {
        errorChecker(headStr);
        return JSON.parse(headStr);
    };

    return bridge(payload, transformer);
}

// 72
export function status(projectId: string): Promise<{
    Added: string[];
    Modified: string[];
    Deleted: string[];
}> {
    const payload = new Uint8Array([72, ...serializeArgs([projectId])]);

    const transformer = ([statusStr]) => {
        errorChecker(statusStr);
        return JSON.parse(statusStr);
    };

    return bridge(payload, transformer);
}

// 73
export function pull(project: Project) {
    const pullWithAuth = (username: string, password: string) => {
        const payload = new Uint8Array([
            73,
            ...serializeArgs([project.id, username, password])
        ]);
        return bridge(payload);
    };

    return checkForAuthRequiredOnCallback(
        project.gitRepository.url,
        "git-pull",
        pullWithAuth
    );
}

// 74
export function restore(projectId: string, files: string[]): Promise<void> {
    const payload = new Uint8Array([
        74,
        ...serializeArgs([projectId, ...files])
    ]);

    return bridge(payload, errorChecker);
}

// 75
export function checkout(
    project: Project,
    branch: string,
    create: boolean = false
): Promise<void> {
    const checkoutWithAuth = (username: string, password: string) => {
        const payload = new Uint8Array([
            75,
            ...serializeArgs([project.id, branch, create, username, password])
        ]);

        return bridge(payload);
    };

    return checkForAuthRequiredOnResponse(
        project.gitRepository.url,
        checkoutWithAuth
    );
}

// 76
export function fetch(project: Project): Promise<void> {
    const fetchWithAuth = (username: string, password: string) => {
        const payload = new Uint8Array([
            76,
            ...serializeArgs([project.id, username, password])
        ]);
        return bridge(payload);
    };

    return checkForAuthRequiredOnResponse(
        project.gitRepository.url,
        fetchWithAuth
    );
}

// 77
export function commit(project: Project, commitMessage: string): Promise<void> {
    const payload = new Uint8Array([
        77,
        ...serializeArgs([
            project.id,
            commitMessage,
            project.gitRepository.name || "",
            project.gitRepository.email || ""
        ])
    ]);

    return bridge(payload, errorChecker);
}

// 78
export async function branches(project: Project) {
    const branchesWithAuth = (username: string, password: string) => {
        const payload = new Uint8Array([
            78,
            ...serializeArgs([project.id, username, password])
        ]);
        return bridge(payload);
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
export function push(project: Project) {
    const pushWithAuth = (username: string, password: string) => {
        const payload = new Uint8Array([
            79,
            ...serializeArgs([project.id, username, password])
        ]);
        bridge(payload);
    };

    checkForAuthRequiredOnCallback(
        project.gitRepository.url,
        "git-push",
        pushWithAuth
    );
}

// 80
export function branchDelete(project: Project, branch: string) {
    const payload = new Uint8Array([
        80,
        ...serializeArgs([project.id, branch])
    ]);

    return bridge(payload, errorChecker);
}
