import { Badge } from "../../../components/primitives/badge";
import rpc from "../../../rpc";
import { Editor } from "../../editor";
import semver from "semver";

export function Version() {
    const container = document.createElement("div");
    container.classList.add("version");

    container.innerHTML = `<h2>Version</h2>`;

    container.append(EditorVersion(), EsbuildVersion(), TypescriptVersion());

    return container;
}

function EditorVersion() {
    const container = document.createElement("div");

    container.innerHTML = `
        <label>Editor</label>
    `;

    rpc()
        .fs.readFile("version.json", { encoding: "utf8" })
        .then((versionFileContent: string) => {
            const { version, branch, commit, commitNumber } =
                JSON.parse(versionFileContent);

            const editorVersionContainer = document.createElement("div");
            editorVersionContainer.classList.add("editor-version");

            const topRow = document.createElement("div");
            topRow.innerText = version;
            editorVersionContainer.append(topRow);

            container.append(editorVersionContainer);

            getLatestVersionTag().then((latestVersion) => {
                const isDev = semver.gt(version, latestVersion);

                const badge = isDev
                    ? Badge({
                          text: "Development",
                          type: "info"
                      })
                    : semver.eq(version, latestVersion)
                      ? Badge({
                            text: "Latest",
                            type: "info-2"
                        })
                      : Badge({
                            text: "Update Available",
                            type: "warning"
                        });

                topRow.prepend(badge);

                if (isDev) {
                    topRow.append(` (${commitNumber})`);
                    const bottomRow = document.createElement("div");
                    bottomRow.innerHTML = `<small>${commit.slice(0, 8)} (${branch})</small>`;
                    editorVersionContainer.append(bottomRow);
                }
            });
        });

    return container;
}

async function getLatestVersionTag() {
    const response = await rpc().fetch(
        "https://api.github.com/repos/fullstackedorg/editor/releases/latest",
        {
            encoding: "utf8"
        }
    );
    return JSON.parse(response.body as string).tag_name;
}

function EsbuildVersion() {
    const container = document.createElement("div");

    container.innerHTML = `
        <label>Esbuild</label>
    `;

    rpc()
        .esbuild.version()
        .then((v) => {
            container.innerHTML += `<div>${v}</div>`;
        });

    return container;
}

function TypescriptVersion() {
    const container = document.createElement("div");

    container.innerHTML = `
        <label>TypeScript</label>
    `;

    const appendTypeScriptVersion = async () => {
        container.innerHTML += `
            <div>${await Editor.tsWorker.call().version()}</div>`;
    };

    if (!Editor.tsWorker)
        Editor.restartTSWorker().then(appendTypeScriptVersion);
    else appendTypeScriptVersion();

    return container;
}
