import { bridge } from "../lib/bridge";
import { serializeArgs } from "../lib/bridge/serialization";
import core_fetch from "../lib/fetch";
import core_message from "../lib/core_message";
import git from "./lib/git";
import {
    createAndMoveProject,
    randomStr,
    tmpDir
} from "./views/add-project/import-zip";
import archive from "../lib/archive";

export async function Demo() {
    try {
        await core_fetch("https://github.com/fullstackedorg", { timeout: 3 });
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

    const [_, demoZipData] = (await bridge(payload)) as [string, Uint8Array];
    const tmpDirectory = tmpDir + "/" + randomStr(6);
    await archive.unzip(demoZipData, tmpDirectory);
    createAndMoveProject(
        tmpDirectory,
        {
            container: null,
            logger: () => {},
            text: null
        },
        "Demo",
        null
    );
}

const demoRepoUrl = "https://github.com/fullstackedorg/demo.git";

async function demoFromGitHub() {
    let checkForDone: (message: string) => void;
    const donePromise = new Promise<void>((resolve) => {
        checkForDone = (gitProgress: string) => {
            let json: { url: string; data: string };
            try {
                json = JSON.parse(gitProgress);
            } catch (e) {
                return;
            }

            if (json.url !== demoRepoUrl) return;

            if (json.data.trim().endsWith("done")) {
                resolve();
            }
        };
    });

    core_message.addListener("git-clone", checkForDone);

    const tmpDirectory = tmpDir + "/" + randomStr(6);
    git.clone(demoRepoUrl, tmpDirectory);

    await donePromise;

    core_message.removeListener("git-clone", checkForDone);

    await createAndMoveProject(
        tmpDirectory,
        {
            container: null,
            logger: () => {},
            text: null
        },
        "Demo",
        demoRepoUrl
    );
}
