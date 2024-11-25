import { serializeArgs } from "../src/serialization";
import { ipc } from "../src/ipc";
import { ipcEditor } from "./ipc";
import {
    createAndMoveProjectFromTmp,
    tmpDir
} from "./views/add-project/import-zip";
import { Platform } from "../src/fullstacked";

export async function Demo() {
    if (platform === Platform.WASM) {
        return demoFromZip();
    }

    try {
        await ipcEditor.fetch("https://github.com", { timeout: 3 });
    } catch (e) {
        return demoFromZip();
    }

    return demoFromGitHub();
}

async function demoFromZip() {
    const payload = new Uint8Array([
        1, // static file serving

        ...serializeArgs(["Demo.zip"])
    ]);

    const [_, demoZipData] = await ipc.bridge(payload);
    await ipcEditor.archive.unzip(tmpDir, demoZipData);
    createAndMoveProjectFromTmp(
        {
            container: null,
            logger: () => {},
            text: null
        },
        "Demo",
        null
    );
}

const demoRepoUrl = "https://github.com/fullstackedorg/editor-sample-demo.git";

async function demoFromGitHub() {
    let checkForDone: (message: string) => void;
    const donePromise = new Promise<void>((resolve) => {
        checkForDone = (progress: string) => {
            if (progress.trim().endsWith("done")) {
                resolve();
            }
        };
    });

    addCoreMessageListener("git-clone", checkForDone);

    ipcEditor.git.clone(demoRepoUrl, tmpDir);

    await donePromise;

    removeCoreMessageListener("git-clone", checkForDone);

    createAndMoveProjectFromTmp(
        {
            container: null,
            logger: () => {},
            text: null
        },
        "Demo",
        demoRepoUrl
    );
}
