import { serializeArgs } from "../../src/serialization"
import ipc from "../../src";

export const git = {
    clone,
    head,
    status,
    pull
}

type ErrorObj = {
    Error: string
}

const errorChecker = ([error]) => {
    if(!error) return;

    let errorObj: ErrorObj;
    try {
        errorObj = JSON.parse(error)
    } catch(e) { }

    if(!errorObj) return;

    throw errorObj;
}

// 70
function clone(url: string, into: string) : Promise<void> {
    const payload = new Uint8Array([
        70,
        ...serializeArgs([into, url])
    ])

    return ipc.bridge(payload, errorChecker);
}

// 71
function head(projectId: string) : Promise<{ Name: string, Hash: string }> {
    const payload = new Uint8Array([
        71,
        ...serializeArgs([projectId])
    ])

    const transformer = ([headStr]) => {
        errorChecker(headStr);
        return JSON.parse(headStr);
    }

    return ipc.bridge(payload, transformer);
}

// 72
function status(projectId: string) : Promise<{
    Added: string[],
    Modified: string[],
    Deleted: string[]
}> {
    const payload = new Uint8Array([
        72,
        ...serializeArgs([projectId])
    ])

    const transformer = ([statusStr]) => {
        errorChecker(statusStr);
        return JSON.parse(statusStr);
    }

    return ipc.bridge(payload, transformer);
}

// 73
function pull(projectId: string) : Promise<void> {
    const payload = new Uint8Array([
        73,
        ...serializeArgs([projectId])
    ])

    return ipc.bridge(payload, errorChecker);
}