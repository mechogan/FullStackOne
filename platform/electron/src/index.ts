import { app } from "electron"

app.on('window-all-closed', () => app.quit())
app.whenReady().then(() => import("./start"));