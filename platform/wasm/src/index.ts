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
    ...editorZip,
    1, // BOOLEAN
    ...numberTo4Bytes(1),
    1
])
const unzipResult = deserializeArgs(call(payload)).at(0)
if (!unzipResult) {
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

window.fetch = async function(url: string, options: any){
    if(url === "/platform") {
        return {
            text: () => new Promise<string>(res => res("wasm"))
        }
    }

    const [_, contents] = staticFileServing(url);
    return {
        text: () => new Promise<string>(res => res(td.decode(contents))),
        arrayBuffer: () => new Promise<ArrayBuffer>(res => res(contents.buffer))
    }
} as any

globalThis.lib = {
    call(payload: Uint8Array) {
        const data = new Uint8Array([
            1, // isEditor
            ...numberTo4Bytes(0), // no project id
            ...payload
        ])
        return call(data);
    }
}

// HEAD (link => style, title => title)
indexHTML.head.querySelectorAll<HTMLElement>(":scope > *")
    .forEach(element => {
        if (element instanceof HTMLTitleElement) {
            document.title = element.innerText;
            return;
        } 

        if (element instanceof HTMLLinkElement && element.rel === "stylesheet") {
            const url = new URL(element.href);
            const [type, content] = staticFileServing(url.pathname);
            const blob = new Blob([content], { type })
            element.href = URL.createObjectURL(blob);
        } 
        
        document.head.append(element);
    });

globalThis.fsWasm = globalThis.fs;

// BODY (script => script, img => img)
indexHTML.body.querySelectorAll<HTMLElement>(":scope > *")
    .forEach(element => {
        if (element instanceof HTMLScriptElement) {
            const script = document.createElement("script");
            script.type = element.type;

            const url = new URL(element.src);
            const [type, content] = staticFileServing(url.pathname);
            const blob = new Blob([content], { type })
            script.src = URL.createObjectURL(blob);
            element = script;
        } else {
            element.querySelectorAll<HTMLImageElement>("img")
                .forEach(replaceImageWithObjectURL);

            if (element instanceof HTMLImageElement) {
                replaceImageWithObjectURL(element)
            }
        }

        document.body.append(element);
    });

function replaceImageWithObjectURL(img: HTMLImageElement) {
    const url = new URL(img.src);
    const [type, imageData] = staticFileServing(url.pathname);
    const blob = new Blob([imageData], { type });
    const objURL = URL.createObjectURL(blob);
    img.src = objURL;
}