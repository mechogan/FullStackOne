import { app, protocol } from "electron";
import { InstanceEditor } from "./instanceEditor";


app.on("window-all-closed", () => app.quit());

app.whenReady().then(() => {
    const editorInstance = new InstanceEditor();
    protocol.handle("http", editorInstance.requestListener.bind(editorInstance));
    editorInstance.start("app-0");
});
