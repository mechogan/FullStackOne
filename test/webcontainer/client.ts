import { WebContainer } from "@webcontainer/api";
import { Terminal } from "@xterm/xterm";

const termContainer = document.createElement("div");
document.body.append(termContainer);

const terminal = new Terminal();
terminal.open(termContainer);

const packageBin = await (await fetch("/build")).arrayBuffer();

// Call only once
const webcontainerInstance = await WebContainer.boot();

webcontainerInstance.mount({
    "package.json": {
        file: {
            contents: `{}`
        }
    },
    "build.tgz": {
        file: {
            contents: new Uint8Array(packageBin)
        }
    }
});

const installProcess = await webcontainerInstance.spawn("npm", [
    "i",
    "build.tgz"
]);
installProcess.output.pipeTo(
    new WritableStream({
        write(data) {
            terminal.write(data);
        }
    })
);
await installProcess.exit;

const runProcess = await webcontainerInstance.spawn("npx", ["fullstacked"]);
runProcess.output.pipeTo(
    new WritableStream({
        write(data) {
            terminal.write(data);
        }
    })
);

webcontainerInstance.on("server-ready", (_, url) => {
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    iframe.src = url;
});
