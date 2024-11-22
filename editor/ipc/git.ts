import { serializeArgs } from "../../src/serialization";
import ipc from "../../src";
import { ipcEditor } from ".";
import { Project } from "../types";

export const git = {
    clone,
    head,
    status,
    pull,
    restore,
    checkout,
    fetch,
    commit
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

// 70
function clone(url: string, into: string): Promise<void> {
    const payload = new Uint8Array([70, ...serializeArgs([into, url])]);

    return ipc.bridge(payload, errorChecker);
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
function pull(projectId: string): Promise<void> {
    const payload = new Uint8Array([73, ...serializeArgs([projectId])]);

    return ipc.bridge(payload, errorChecker);
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
function checkout(projectId: string, branch: string): Promise<void> {
    const payload = new Uint8Array([75, ...serializeArgs([projectId, branch])]);

    return ipc.bridge(payload, errorChecker);
}

// 76
function fetch(projectId: string): Promise<void> {
    const payload = new Uint8Array([76, ...serializeArgs([projectId])]);

    return ipc.bridge(payload, errorChecker);
}

// 77
function commit(project: Project, commitMessage: string): Promise<void> {
    const payload = new Uint8Array([77, ...serializeArgs([
        project.id, 
        commitMessage, 
        project.gitRepository.name || "",
        project.gitRepository.email || ""
    ])]);

    return ipc.bridge(payload, errorChecker);
}