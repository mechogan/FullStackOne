import ffi from "ffi-rs"
import http from "http";
import open from "open";
import path from "path";
import fs from "fs";
import os from "os";
import { numberTo4Bytes } from "../../../src/serialization";

const library = "fullstacked";
const libPath = path.resolve(process.cwd(), "bin", "win-x86_64.dll");
console.log(fs.existsSync(libPath))
ffi.open({
    library: library,
    path: libPath
});

const root = path.resolve(os.homedir(), "FullStacked");
const directories = {
    root,
    config: path.resolve(root, ".config"),
    nodeModules: path.resolve(root, ".config", "node_modules"),
    editor: path.resolve(process.cwd(), "editor"),
}

await ffi.load({
    errno: false,
    library,
    funcName: "directories",
    paramsType: [
        ffi.DataType.String,
        ffi.DataType.String,
        ffi.DataType.String,
        ffi.DataType.String,
    ],
    retType: ffi.DataType.Void,
    paramsValue: [
        directories.root,
        directories.config,
        directories.nodeModules,
        directories.editor
    ],
    runInNewThread: true,
    freeResultMemory: true
});



const requestHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const uint8array = new TextEncoder().encode(req.url);
    const request = new Uint8Array([
        1,
        1,
        ...numberTo4Bytes(0),
        2, // STRING
        ...numberTo4Bytes(uint8array.length),
        ...uint8array
    ])

    const responsePtr = ffi.createPointer({
        paramsType: [ffi.arrayConstructor({
            type: ffi.DataType.U8Array,
            length: 0
        })],
        paramsValue: [new Uint8Array()]
    })

    const responseLength = await ffi.load({
        errno: false,
        library,
        funcName: "call",
        paramsType: [
            ffi.DataType.U8Array,
            ffi.DataType.I32,
            ffi.DataType.External
        ],
        retType: ffi.DataType.I32,
        paramsValue: [
            request,
            request.byteLength,
            responsePtr.at(0)
        ],
        runInNewThread: true,
        freeResultMemory: true
    });

    const uint8arrayConstructor = ffi.arrayConstructor({
        type: ffi.DataType.U8Array,
        length: responseLength
    })

    const data = ffi.restorePointer({
        retType: [uint8arrayConstructor],
        paramsValue: responsePtr
    }).at(0) as unknown as Buffer;

    ffi.load({
        errno: false,
        library,
        funcName: "freePtr",
        paramsType: [
            ffi.DataType.External
        ],
        retType: ffi.DataType.Void,
        paramsValue: [
            ffi.unwrapPointer(responsePtr).at(0)
        ],
        runInNewThread: true,
        freeResultMemory: true
    });

    ffi.freePointer({
        paramsType: [uint8arrayConstructor],
        paramsValue: responsePtr,
        pointerType: ffi.PointerType.RsPointer
    })

    const response = new Uint8Array(data.buffer);

    console.log(new TextDecoder().decode(response))

}

const port = 9000;

http
    .createServer(requestHandler)
    .listen(port);

open(`http://localhost:${port}`);

['SIGINT', 'SIGTERM', 'SIGQUIT']
    .forEach(signal => process.on(signal, () => {
        /** do your logic */
        process.exit();
    }));