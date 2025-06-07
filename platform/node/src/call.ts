import ffi from "ffi-rs";
import path from "path";
import os from "os";
import fs from "node:fs";

const platform = os.platform();
const libBinary =
    platform + "-" + os.arch() + (platform === "win32" ? ".dll" : ".so");
const binDirectory = path.resolve(process.cwd(), "..", "..", "core", "bin");
const libPath = path.resolve(binDirectory, libBinary);

if (!fs.existsSync(libPath)) {
    throw "unknown platform";
}

const library = "fullstacked";
ffi.open({
    library: library,
    path: libPath
});

export function setDirectories(directories: {
    root: string;
    config: string;
    editor: string;
}) {
    return ffi.load({
        errno: false,
        library,
        funcName: "directories",
        paramsType: [
            ffi.DataType.String,
            ffi.DataType.String,
            ffi.DataType.String
        ],
        retType: ffi.DataType.Void,
        paramsValue: [directories.root, directories.config, directories.editor],
        runInNewThread: true,
        freeResultMemory: true
    });
}

export function setCallback(
    cb: (projectId: string, messageType: string, message: string) => void
) {
    const funcExternal = ffi.createPointer({
        paramsType: [
            ffi.funcConstructor({
                paramsType: [
                    ffi.DataType.String,
                    ffi.DataType.String,
                    ffi.DataType.String
                ],
                retType: ffi.DataType.Void
            })
        ],
        paramsValue: [cb]
    });

    return ffi.load({
        library,
        funcName: "callback",
        retType: ffi.DataType.Void,
        paramsType: [ffi.DataType.External],
        paramsValue: ffi.unwrapPointer(funcExternal),
        runInNewThread: true,
        freeResultMemory: true
    });
}

let id = 0;
export async function callLib(payload: Uint8Array) {
    const callId = id++;

    const responseLength = await ffi.load({
        errno: false,
        library,
        funcName: "call",
        paramsType: [ffi.DataType.I32, ffi.DataType.U8Array, ffi.DataType.I32],
        retType: ffi.DataType.I32,
        paramsValue: [callId, payload, payload.byteLength],
        runInNewThread: true,
        freeResultMemory: true
    });

    const response = Buffer.alloc(responseLength);
    await ffi.load({
        errno: false,
        library,
        funcName: "getResponse",
        paramsType: [ffi.DataType.I32, ffi.DataType.U8Array],
        retType: ffi.DataType.Void,
        paramsValue: [callId, response],
        runInNewThread: true,
        freeResultMemory: true
    });

    return new Uint8Array(response);
}
