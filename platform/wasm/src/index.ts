import { deserializeArgs, numberTo4Bytes } from "../../../src/serialization";

declare global {
    class Go {
        importObject: WebAssembly.Imports;
        run: Function;
    }
    var directories: (root: string, config: string, nodeModules: string, editor: string) => void;
    var call: (payload: Uint8Array) => Uint8Array;
}

const go = new Go();
const result = await WebAssembly.instantiateStreaming(fetch("bin/wasm.wasm"), go.importObject);
go.run(result.instance);

const dirs = {
    root: "projects",
    config: "config",
    nodeModules: "node_modules",
    editor: "editor"
}

directories(
    dirs.root,
    dirs.config,
    dirs.nodeModules,
    dirs.editor
)

const te = new TextEncoder();
const editorDir = te.encode(dirs.editor);
const editorZip = new Uint8Array(await (await fetch("editor.zip")).arrayBuffer());
let payload = new Uint8Array([
    1, // isEditor
    ...numberTo4Bytes(0), // no project id,
    30, // UNZIP
    2, // STRING
    ...numberTo4Bytes(editorDir.length),
    ...editorDir,
    4, // BUFFER
    ...numberTo4Bytes(editorZip.length),
    ...editorZip
])
const unzipResult = deserializeArgs(call(payload)).at(0)
if(!unzipResult) {
    console.error("Failed to unzip editor");
}


function staticFileServing(pathname: string) {
    const pathnameData = te.encode(pathname);
    let payload = new Uint8Array([
        1, // isEditor
        ...numberTo4Bytes(0), // no project id,
        1, // Static File serving
        2, // STRING
        ...numberTo4Bytes(pathnameData.length),
        ...pathnameData
    ])

    const response = deserializeArgs(call(payload))
    return response;
}

const td = new TextDecoder()

const [mimeType, contents] = staticFileServing("/");

const parser = new DOMParser();
const indexHTML = parser.parseFromString(td.decode(contents), mimeType)

console.log(indexHTML)


export { };