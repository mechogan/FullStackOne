import path from "path";
import { app, protocol } from "electron";
import { InstanceEditor } from "./instanceEditor";
import { installEsbuild, loadEsbuild } from "./esbuild";

if (require("electron-squirrel-startup")) app.quit();



// hostname => Instance
const instances = new Map<string, Instance>();






let editorInstance: InstanceEditor;

const deepLinksScheme = "fullstacked";
let launchURL: string = process.argv.find((arg) =>
    arg.startsWith(deepLinksScheme)
);
const maybeLaunchURL = (maybeURL: string) => {
    if (!maybeURL || !maybeURL.startsWith(deepLinksScheme)) return;

    if (editorInstance) {
        editorInstance.push("launchURL", maybeURL);
        launchURL = null;
    } else launchURL = maybeURL;
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
    editorInstance.bonjour.bonjour.unpublishAll(() => app.quit());
});

app.whenReady().then(async () => {
    editorInstance = new InstanceEditor({
        install: installEsbuild,
        load: loadEsbuild
    });
    protocol.handle(
        "http",
        editorInstance.requestListener.bind(editorInstance)
    );
    await editorInstance.start("localhost");
    maybeLaunchURL(launchURL);
});
