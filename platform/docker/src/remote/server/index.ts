import http from "http";
import fs from "fs";
import path from "path";
import mime from "mime";
import url from "url";
import os from "os";
import { WebSocketServer, WebSocket } from "ws";
import { launch, getStream } from "puppeteer-stream";
import type { Transform } from "stream";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const notFound = (res: http.ServerResponse) => {
    res.writeHead(404);
    res.end();
};

const serveStaticFile = (url: string, res: http.ServerResponse) => {
    let pathname = url.split("?").shift();
    if (pathname?.endsWith("/")) pathname = pathname.slice(0, -1);
    if (pathname?.startsWith("/")) pathname = pathname.slice(1);
    if (pathname === "") pathname = "index.html";

    const filePath = path.resolve(__dirname, "dist", pathname);
    if (!fs.existsSync(filePath)) return false;

    const type = mime.getType(filePath);
    const data = fs.readFileSync(filePath);

    res.writeHead(200, {
        "content-type": type,
        "content-length": data.byteLength
    });
    res.write(data);
    res.end();

    return true;
};

const requestHandler = (
    req: http.IncomingMessage,
    res: http.ServerResponse
) => {
    if (serveStaticFile(req.url, res)) return;
    notFound(res);
};

const server = http.createServer(requestHandler);

const wss = new WebSocketServer({ server });

let streamingWS: WebSocket = null,
    onMessageWebRTC: (messageWebRTC: string) => void,
    messagesRTC: string[] = [];
wss.on("connection", (ws) => {
    streamingWS?.close();
    streamingWS = ws;
    ws.onmessage = async (message) => {
        const event = JSON.parse(message.data as string);
        switch (event.type) {
            case "restart":
                await browser?.close();
                browser = null;
                break;
            case "click":
                await page.mouse.click(event.x, event.y);
                break;
            case "key":
                await page.keyboard.press(event.key);
                break;
            case "close":
                (await browser?.pages())
                    ?.find((page) => page.url() === event.url)
                    ?.close();
                break;
            case "webrtc":
                if (onMessageWebRTC) {
                    onMessageWebRTC(JSON.stringify(event.message));
                } else {
                    messagesRTC.push(JSON.stringify(event.message));
                }
                break;
        }
    };
    ws.on("close", () => {
        streamingWS = null;
    });
    restartBrowserStreaming();
});

let browser: Awaited<ReturnType<typeof launch>>,
    page: Awaited<ReturnType<(typeof browser)["newPage"]>>;
const restartBrowserStreaming = async () => {
    let defaultViewport = {
        width: 960,
        height: 800
    };

    if (
        !browser?.connected ||
        !(await browser.pages()).find(
            (page) => page.url() === "http://localhost:9000/"
        )
    ) {
        await browser?.close();
        browser = await launch({
            executablePath:
                os.platform() === "darwin"
                    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
                    : "/usr/bin/chromium-browser",
            defaultViewport,
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
        });
        page = await browser.newPage();
        page.on("console", (message) =>
            streamingWS?.send(JSON.stringify({ log: message.text() }), {
                binary: false
            })
        );
        await page.goto("http://localhost:9000");
    }

    if (os.platform() === "darwin") {
        const extension = await getExtensionPage(page.browser());
        const [{ height, width }] = await extension.evaluate(
            async (x) => {
                // @ts-ignore
                return chrome.tabs.query(x);
            },
            {
                active: true
            }
        );
        defaultViewport = { height, width };
    }

    streamingWS?.send(JSON.stringify({ viewport: defaultViewport }), {
        binary: false
    });

    onMessageWebRTC = await getStream(
        page,
        { audio: false, video: true },
        (messageWebRTC: string) => {
            streamingWS?.send(JSON.stringify({ webrtc: messageWebRTC }));
        }
    );
    if (messagesRTC.length) {
        while (messagesRTC.length) {
            onMessageWebRTC(messagesRTC.shift());
        }
    }
};

server.listen(12000);

const tabsStatus = async () => {
    if (!browser || !streamingWS) return;
    streamingWS.send(
        JSON.stringify({
            tabs: (await browser.pages())?.map((page) => page.url())
        })
    );
};
setInterval(tabsStatus, 2000);

const extensionId = "jjndjgheafjngoipoacpjgeicjeomjli";
async function getExtensionPage(browser) {
    const extensionTarget = await browser.waitForTarget((target) => {
        return (
            target.type() === "page" &&
            target
                .url()
                .startsWith(`chrome-extension://${extensionId}/options.html`)
        );
    });
    if (!extensionTarget) throw new Error("cannot load extension");
    const videoCaptureExtension = await extensionTarget.page();
    if (!videoCaptureExtension) throw new Error("cannot get page of extension");
    return videoCaptureExtension;
}
