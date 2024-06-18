import path from "path";
import os from "os";
import slugify from "slugify";
import { BrowserWindow, app, protocol, shell } from "electron";
import { installEsbuild, loadEsbuild } from "./esbuild";
import {
    EsbuildFunctions,
    OpenDirectoryFunction,
    OpenFunction,
    PushFunction,
    main
} from "../../node/src/main";
import { SetupDirectories } from "../../../editor/rpc";
import { Platform } from "../../../src/platforms";

if (require("electron-squirrel-startup")) app.quit();

// hostname => instance.id
const hostnames = new Map<string, string>();
// instance.id => BrowserWindow
const runningInstances = new Map<string, BrowserWindow>();

const editorDirectory = path.resolve(__dirname, "..", "editor");

const rootDirectory = os.homedir();
const configDirectory = process.env.CONFIG_DIR || ".config/fullstacked";

const directories: SetupDirectories = {
    rootDirectory,
    baseJS: path.resolve(__dirname, "..", "js", "index.js"),
    cacheDirectory: ".cache/fullstacked",
    configDirectory,
    nodeModulesDirectory: configDirectory + "/node_modules"
};

const configDirectoryAbs =
    directories.rootDirectory + "/" + directories.configDirectory;

const esbuild: EsbuildFunctions = {
    load: () => loadEsbuild(configDirectoryAbs),
    install: () =>
        installEsbuild(configDirectoryAbs, (data) => {
            push("FullStacked", "installEsbuild", JSON.stringify(data));
        })
};

const open: OpenFunction = (id, project) => {
    let window = runningInstances.get(id);

    if (!window) {
        const hostname = slugify(project.title, { lower: true });

        window = new BrowserWindow({
            width: 800,
            height: 600,
            title: project.title,
            icon: "icons/icon.png"
        });

        window.loadURL(`http://${hostname}`);

        hostnames.set(hostname, id);
        runningInstances.set(id, window);

        window.on("close", () => {
            hostnames.delete(hostname);
            runningInstances.delete(id);
            close(id);
        });
    } else {
        window.reload();
        window.focus();
    }
};

const push: PushFunction = (id, messageType, message) => {
    const window = runningInstances.get(id);
    if (!window) return;
    window.webContents.executeJavaScript(
        `window.push("${messageType}", \`${message.replace(/\\/g, "\\\\")}\`)`
    );
};
const openDirectory: OpenDirectoryFunction = (directory: string) => {
    let directoryAbs = rootDirectory + "/" + directory;
    if (os.platform() === "win32")
        directoryAbs = directoryAbs.split("/").join("\\");
    shell.openPath(directory);
};

const { handler, close } = main(
    Platform.ELECTRON,
    editorDirectory,
    directories,
    esbuild,
    open,
    push,
    openDirectory
);

const deepLinksScheme = "fullstacked";
let launchURL: string = process.argv.find((arg) =>
    arg.startsWith(deepLinksScheme)
);
const maybeLaunchURL = (maybeURL: string) => {
    if (!maybeURL || !maybeURL.startsWith(deepLinksScheme)) return;

    const editor = runningInstances.get("FullStacked");
    if (editor) {
        push("FullStacked", "launchURL", maybeURL);
    } else {
        launchURL = maybeURL;
    }
};

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(deepLinksScheme, process.execPath, [
            path.resolve(process.argv[1])
        ]);
    }
} else {
    app.setAsDefaultProtocolClient(deepLinksScheme);
}

app.on("open-url", (event, url) => maybeLaunchURL(url));

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on("second-instance", (_, commandLine) =>
        maybeLaunchURL(commandLine.pop())
    );
}

app.on("window-all-closed", () => {
    close("FullStacked").then(() => app.quit());
});

const protocolHandler: (request: Request) => Promise<Response> = async (
    request
) => {
    const url = new URL(request.url);
    const hostname = url.hostname;
    const id = hostnames.get(hostname);

    const body = new Uint8Array(await request.arrayBuffer());

    const response = await handler(id, url.pathname, body);

    const headers = {
        ["Content-Type"]: response.mimeType
    };

    if (response.data) {
        headers["Content-Length"] = response.data.byteLength.toString();
    }

    return new Response(response.data || "", {
        status: response.status,
        headers
    });
};

app.whenReady().then(async () => {
    protocol.handle("http", protocolHandler);

    open("FullStacked", {
        title: "localhost",
        location: null,
        createdDate: null
    });
});
