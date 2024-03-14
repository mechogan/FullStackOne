import { app } from "electron";
import path from "path";

if (require("electron-squirrel-startup")) app.quit();

const deepLinksScheme = "fullstacked";

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient("fullstacked", process.execPath, [
            path.resolve(process.argv[1])
        ]);
    }
} else {
    app.setAsDefaultProtocolClient("fullstacked");
}

app.on("window-all-closed", () => app.quit());
app.whenReady().then(() => import("./start"));
