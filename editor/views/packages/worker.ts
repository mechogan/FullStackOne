import "./worker-env";
import rpc from "../../rpc";
import gzip from "gzip-js";
import untar from "js-untar";

export type PackageInstallerWorkerMessage =
    | {
        type: "ready";
    }
    | {
        name: string;
        type: "progress";
        status: string;
        loaded?: number;
        total?: number;
    }
    | {
        name: string;
        type: "dependencies";
        packages: string[];
    }
    | {
        name: string;
        type: "done";
        success: boolean;
    };

const nodeModulesDirectory = await rpc().directories.nodeModulesDirectory();
const td = new TextDecoder();

const maxPayloadSize = 100000; // 100kb
const maxFilesPerPaylod = 10;

self.onmessage = (message: MessageEvent) => {
    install(message.data)
        .then(() =>
            sendMessage({
                name: message.data,
                type: "done",
                success: true
            })
        )
        .catch(() =>
            sendMessage({
                name: message.data,
                type: "done",
                success: false
            })
        );
};

const sendMessage = (message: PackageInstallerWorkerMessage) => {
    self.postMessage(message);
};

async function install(name: string) {
    sendMessage({
        name,
        type: "progress",
        status: "downloading"
    });

    const packageInfoStr = (
        await rpc().fetch(`https://registry.npmjs.org/${name}/latest`)
    ).body;
    const packageInfoJSON = JSON.parse(packageInfoStr);
    const tarbalUrl = packageInfoJSON.dist.tarball;
    const tarballData = await rpc().fetchRaw(tarbalUrl);

    sendMessage({
        name,
        type: "progress",
        status: "unpacking"
    });
    const tarData = new Uint8Array(gzip.unzip(tarballData));
    await rpc().fs.mkdir(`${nodeModulesDirectory}/${name}`, {
        absolutePath: true
    });
    const files: {
        name: string;
        buffer: ArrayBufferLike;
        type: string; // https://en.wikipedia.org/wiki/Tar_(computing)#UStar_format
    }[] = await untar(tarData.buffer);

    let filesToWrite: [string, Uint8Array][] = [];
    const writeFiles = async () => {
        await rpc().fs.writeFileMulti({
            absolutePath: true,
            recursive: true
        }, ...filesToWrite.flat());
        filesToWrite = [];
    };

    const packageJSONFile = `${nodeModulesDirectory}/${name}/package.json`;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type === "5") continue;

        const pathComponents = file.name.split("/").slice(1); // strip 1
        const path = `${nodeModulesDirectory}/${name}/${pathComponents.join("/")}`;

        if (path === packageJSONFile) {
            const packageJSON = JSON.parse(td.decode(file.buffer));
            if (packageJSON.dependencies) {
                sendMessage({
                    name,
                    type: "dependencies",
                    packages: Object.keys(packageJSON.dependencies)
                });
            }
        }

        let currentPayloadSize = filesToWrite.reduce(
            (sum, [_, data]) => sum + data.byteLength,
            0
        );

        if (
            currentPayloadSize >= maxPayloadSize ||
            filesToWrite.length >= maxFilesPerPaylod
        ) {
            await writeFiles();
        }

        filesToWrite.push([path, new Uint8Array(file.buffer)]);

        sendMessage({
            name,
            type: "progress",
            status: `(${i}/${files.length}) unpacking`,
            loaded: i + 1,
            total: files.length
        });
    }

    // maybe leftovers
    if (filesToWrite.length) {
        await writeFiles();
    }

    sendMessage({
        name,
        type: "progress",
        status: "installed",
        loaded: 1,
        total: 1
    });
}

sendMessage({
    type: "ready"
});
