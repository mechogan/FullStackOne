import "winbox/dist/css/winbox.min.css";
import wb from "winbox/src/js/winbox";
import type WinBoxType from "winbox";
import { deserializeArgs, numberTo4Bytes } from "../../../src/serialization";

const WinBox = wb as WinBoxType.WinBoxConstructor

declare global {
    class Go {
        importObject: WebAssembly.Imports;
        run: Function;
    }
    var directories: (root: string, config: string, editor: string) => void;
    var call: (payload: Uint8Array) => Uint8Array;
}

type FullStackedWindow = Window & {
    originalFetch?: typeof fetch;
    oncoremessage?: (messageType: string, message: string) => void
    lib?: {
        call: (payload: Uint8Array) => Uint8Array;
    }
}

const webviews = new Map<string, {
    window: FullStackedWindow,
    winbox?: WinBoxType
}>()

function createWindow(projectId: string) {
    const iframe = document.createElement("iframe");
    iframe.style.height = "100%";
    iframe.style.width = "100%";
    const winbox = new WinBox(projectId, { mount: iframe })
    webviews.set(projectId, {
        window: iframe.contentWindow,
        winbox
    });
    initProjectWindow(projectId);
}

globalThis.onmessageWASM = function (projectId: string, messageType: string, message: string) {
    if (projectId === "" && messageType === "open") {
        createWindow(message);
        return;
    }

    const webview = webviews.get(projectId);
    webview.window.oncoremessage(messageType, message)
}

const go = new Go();
const result = await WebAssembly.instantiateStreaming(
    fetch("bin/wasm.wasm"),
    go.importObject
);
go.run(result.instance);

const dirs = {
    root: "projects",
    config: "config",
    nodeModules: "node_modules",
    editor: "editor"
};

directories(dirs.root, dirs.config, dirs.editor);

const te = new TextEncoder();
const editorDir = te.encode(dirs.editor);
const editorZip = new Uint8Array(
    await (await fetch("editor.zip")).arrayBuffer()
);
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
]);
const unzipResult = deserializeArgs(call(payload)).at(0);
if (!unzipResult) {
    console.error("Failed to unzip editor");
}

function staticFileServing(projectId: string, pathname: string) {
    const projectIdData = te.encode(projectId)
    const pathnameData = te.encode(pathname);
    let payload = new Uint8Array([
        projectId === "" ? 1 : 0,
        ...numberTo4Bytes(projectIdData.byteLength),
        ...projectIdData,
        1, // Static File serving
        2, // STRING
        ...numberTo4Bytes(pathnameData.length),
        ...pathnameData
    ]);
    const responseRaw = call(payload);
    const response = deserializeArgs(responseRaw);
    return response;
}

webviews.set("", { window });
initProjectWindow("");

function initProjectWindow(projectId: string) {
    globalThis.td = new window.TextDecoder();

    const webview = webviews.get(projectId);
    if (!webview) return;

    webview.window.originalFetch = webview.window.fetch;
    webview.window.fetch = async function (url: string, options: any) {
        if (url.startsWith("http")) {
            return webview.window.originalFetch(url, options);
        }

        if (url === "/platform") {
            return {
                text: () => new Promise<string>((res) => res("wasm"))
            };
        }

        const [_, contents] = staticFileServing(projectId, url);
        return {
            text: () => new Promise<string>((res) => res(globalThis.td.decode(contents))),
            arrayBuffer: () =>
                new Promise<ArrayBuffer>((res) => res(contents.buffer))
        };
    } as any;

    if (projectId === "") {
        (window as any).lib = {
            call(payload: Uint8Array) {
                const data = new Uint8Array([
                    1, // isEditor
                    ...numberTo4Bytes(0), // no project id
                    ...payload
                ]);
                return call(data);
            }
        };
    } else {
        const projectIdData = te.encode(projectId);
        const header = new Uint8Array([
            0,
            ...numberTo4Bytes(projectIdData.byteLength),
            ...projectIdData
        ])
        webview.window.lib = {
            call(payload: Uint8Array) {
                const data = new Uint8Array([
                    ...header,
                    ...payload
                ]);
                return call(data);
            }
        };
    }


    const [mimeType, contents] = staticFileServing(projectId, "/");

    const parser = new DOMParser();
    const indexHTML = parser.parseFromString(globalThis.td.decode(contents), mimeType);

    webview.window.document.body.innerText = "";

    // HEAD (link => style, title => title)
    indexHTML.head
        .querySelectorAll<HTMLElement>(":scope > *")
        .forEach((element) => {
            if (element instanceof HTMLTitleElement) {
                if(projectId == "") {
                    webview.window.document.title = element.innerText;
                } else {
                    webview.winbox.setTitle(element.innerText);
                }
                return;
            }

            if (
                element instanceof HTMLLinkElement &&
                element.rel === "stylesheet"
            ) {
                const url = new URL(element.href);
                const [type, content] = staticFileServing(projectId, url.pathname);
                const blob = new Blob([content], { type });
                element.href = window.URL.createObjectURL(blob);
            }

            webview.window.document.head.append(element);
        });

    // BODY (script => script, img => img)
    indexHTML.body
        .querySelectorAll<HTMLElement>(":scope > *")
        .forEach((element) => {
            if (element instanceof HTMLScriptElement) {
                const script = window.document.createElement("script");
                script.type = element.type;

                const url = new URL(element.src);
                const [type, content] = staticFileServing(projectId, url.pathname);
                const blob = new Blob([content], { type });
                script.src = URL.createObjectURL(blob);
                element = script;
            } else {
                element
                    .querySelectorAll<HTMLImageElement>("img")
                    .forEach(e => replaceImageWithObjectURL(projectId, e));

                if (element instanceof HTMLImageElement) {
                    replaceImageWithObjectURL(projectId, element);
                }
            }

            webview.window.document.body.append(element);
        });
}

function replaceImageWithObjectURL(projectId: string, img: HTMLImageElement) {
    const url = new URL(img.src);
    const [type, imageData] = staticFileServing(projectId, url.pathname);
    const blob = new Blob([imageData], { type });
    const objURL = URL.createObjectURL(blob);
    img.src = objURL;
}