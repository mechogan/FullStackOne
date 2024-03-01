import { app } from "electron";

if (require("electron-squirrel-startup")) app.quit();

app.on("window-all-closed", () => app.quit());
app.whenReady().then(() => import("./start"));
