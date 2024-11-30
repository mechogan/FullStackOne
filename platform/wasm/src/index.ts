import "winbox/dist/css/winbox.min.css";
import wb from "winbox/src/js/winbox";
import type WinBoxType from "winbox";
import { deserializeArgs, numberTo4Bytes } from "../../../src/serialization";

const WinBox = wb as WinBoxType.WinBoxConstructor;

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
    oncoremessage?: (messageType: string, message: string) => void;
    lib?: {
        call: (payload: Uint8Array) => Uint8Array;
    };
};

const webviews = new Map<
    string,
    {
        window: FullStackedWindow;
        winbox?: WinBoxType;
    }
>();

const aspectRatio = 16 / 11;
const isLandscape = () => window.innerWidth > window.innerHeight;
const newWinboxHeight = () => {
    let height = window.innerHeight;
    if (isLandscape()) {
        height = window.innerHeight * 0.6;
    } else {
        height = newWinboxWidth() * aspectRatio;
    }
    if (height > window.innerHeight) {
        return window.innerHeight;
    }
    return height;
};
const newWinboxWidth = () => {
    let width = window.innerWidth;
    if (isLandscape()) {
        width = newWinboxHeight() * aspectRatio;
    } else {
        width = window.innerWidth * 0.6;
        if (width < 450) {
            width = window.innerWidth;
        }
    }
    if (width > window.innerWidth) {
        return window.innerWidth;
    }
    return width;
};

function createWindow(projectId: string) {
    const iframe = document.createElement("iframe");
    iframe.style.height = "100%";
    iframe.style.width = "100%";
    const height = newWinboxHeight();
    console.log(height);
    const width = newWinboxWidth();
    console.log(height, width);
    const winbox = new WinBox(projectId, {
        mount: iframe,
        height,
        width,
        x: window.innerWidth / 2 - width / 2,
        y: window.innerHeight / 2 - height / 2
    });
    webviews.set(projectId, {
        window: iframe.contentWindow,
        winbox
    });
    initProjectWindow(projectId);
}

globalThis.onmessageWASM = function (
    projectId: string,
    messageType: string,
    message: string
) {
    if (projectId === "" && messageType === "open") {
        createWindow(message);
        return;
    }

    const webview = webviews.get(projectId);
    webview.window.oncoremessage(messageType, message);
};

async function dowloadWASM(): Promise<Uint8Array> {
    const response = await fetch("bin/wasm.wasm");
    const contentLength = response.headers.get('content-length');
    const dataSize = parseInt(contentLength);
    const data = new Uint8Array(dataSize);
    const reader = response.body.getReader();
    let readCount = 0;
    const progressElement = document.querySelector<HTMLDivElement>("#progress");
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        data.set(value, readCount)
        readCount += value.byteLength;
        if (progressElement) {
            progressElement.style.width = readCount / dataSize * 100 + "%";
        }
    }
    reader.releaseLock();
    return data;
}

const go = new Go();
const result = await WebAssembly.instantiate(
    await dowloadWASM(),
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
    const projectIdData = te.encode(projectId);
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
    webview.window.fetch = async function (
        url: string | Request,
        options: any
    ) {
        if (typeof url === "object") {
            return webview.window.originalFetch(url);
        }

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
            text: () =>
                new Promise<string>((res) =>
                    res(globalThis.td.decode(contents))
                ),
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
        ]);
        webview.window.lib = {
            call(payload: Uint8Array) {
                const data = new Uint8Array([...header, ...payload]);
                return call(data);
            }
        };
    }

    const [mimeType, contents] = staticFileServing(projectId, "/");

    const parser = new DOMParser();
    const indexHTML = parser.parseFromString(
        globalThis.td.decode(contents),
        mimeType
    );

    Array.from(webview.window.document.body.children).forEach(child => child.remove());

    // HEAD (link => style, title => title)
    indexHTML.head
        .querySelectorAll<HTMLElement>(":scope > *")
        .forEach((element) => {
            if (element instanceof HTMLTitleElement) {
                if (projectId == "") {
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
                const [type, content] = staticFileServing(
                    projectId,
                    url.pathname
                );
                const blob = new Blob([content], { type });
                element.href = window.URL.createObjectURL(blob);
                element.onload = () => {
                    checkForPageBGColor(webview);
                };
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
                const [type, content] = staticFileServing(
                    projectId,
                    url.pathname
                );
                const blob = new Blob([content], { type });
                script.src = URL.createObjectURL(blob);
                element = script;
            } else {
                element
                    .querySelectorAll<HTMLImageElement>("img")
                    .forEach((e) => replaceImageWithObjectURL(projectId, e));

                if (element instanceof HTMLImageElement) {
                    replaceImageWithObjectURL(projectId, element);
                }
            }

            webview.window.document.body.append(element);
        });

    checkForPageBGColor(webview);
}

function checkForPageBGColor(webview: { window: FullStackedWindow, winbox?: WinBoxType }) {
    const bgColor = webview.window.getComputedStyle(
        webview.window.document.documentElement
    ).backgroundColor;
    const hexColor = RGBAToHexA(bgColor, true);
    if (hexColor === "#000000" || !webview.winbox) return;
    webview.winbox?.setBackground(hexColor);
    if (isBgColorDark(hexColor)) {
        (
            webview.winbox?.dom as HTMLElement
        ).querySelector<HTMLDivElement>(
            ".wb-header"
        ).style.color = "white";
        (
            webview.winbox?.dom as HTMLElement
        ).querySelector<HTMLDivElement>(
            ".wb-control"
        ).style.filter = "invert(0)";
    } else {
        (
            webview.winbox?.dom as HTMLElement
        ).querySelector<HTMLDivElement>(
            ".wb-header"
        ).style.color = "black";
        (
            webview.winbox?.dom as HTMLElement
        ).querySelector<HTMLDivElement>(
            ".wb-control"
        ).style.filter = "invert(1)";
    }
}

function replaceImageWithObjectURL(projectId: string, img: HTMLImageElement) {
    const url = new URL(img.src);
    const [type, imageData] = staticFileServing(projectId, url.pathname);
    const blob = new Blob([imageData], { type });
    const objURL = URL.createObjectURL(blob);
    img.src = objURL;
}

function RGBAToHexA(rgba: string, forceRemoveAlpha = false) {
    return (
        "#" +
        rgba
            .replace(/^rgba?\(|\s+|\)$/g, "") // Get's rgba / rgb string values
            .split(",") // splits them at ","
            .filter((string, index) => !forceRemoveAlpha || index !== 3)
            .map((string) => parseFloat(string)) // Converts them to numbers
            .map((number, index) =>
                index === 3 ? Math.round(number * 255) : number
            ) // Converts alpha to 255 number
            .map((number) => number.toString(16)) // Converts numbers to hex
            .map((string) => (string.length === 1 ? "0" + string : string)) // Adds 0 when length of one number is 1
            .join("")
    ); // Puts the array to togehter to a string
}

function isBgColorDark(bgColor: string) {
    return parseInt(bgColor.replace("#", ""), 16) < 0xffffff / 2;
}
