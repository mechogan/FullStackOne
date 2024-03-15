import { app } from "electron";
import path from "path";
import { JavaScript } from "../../node/src/javascript";

if (require("electron-squirrel-startup")) app.quit();

const deepLinksScheme = "fullstacked";

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(deepLinksScheme, process.execPath, [
            path.resolve(process.argv[1])
        ]);
    }
} else {
    app.setAsDefaultProtocolClient(deepLinksScheme);
}

let js: JavaScript, urlToLaunch: string;

const launchURL = () => {
    js.processRequest(
        {},
        "launchURL",
        new Uint8Array(Buffer.from(JSON.stringify([urlToLaunch]))),
        () => {}
    );
    urlToLaunch = null;
}

// deeplink
app.on('open-url', (event, url) => {
    urlToLaunch = url
        .slice("fullstacked://".length) // remove scheme in front
        .replace(/https?\/\//, value => value.slice(0, -2) + "://") // add : in http(s) protocol

    if(js) launchURL();
})

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_, commandLine) => {
    urlToLaunch = commandLine.pop()
        .slice("fullstacked://".length) // remove scheme in front
        .replace(/https?\/\//, value => value.slice(0, -2) + "://") // add : in http(s) protocol

    if(js) launchURL();
  });
}

app.on("window-all-closed", () => app.quit());

app.whenReady().then(async () => {
    js = (await import("./start")).default;

    if(urlToLaunch) launchURL();

});
