import { promises } from "node:fs";
import { buildSASS } from "../../../editor/lib/esbuild/sass";
import type { Project } from "../../../editor/types";
import { createPayloadHeader } from "./instance";
import { callLib } from "./call";
import {
    deserializeArgs,
    serializeArgs
} from "../../../lib/bridge/serialization";
import { toByteArray } from "../lib/base64";
import { cbListener } from ".";
import type { Message } from "esbuild";

function quickInstallPacakge(editorHeader: Uint8Array) {
    return new Promise<void>((resolve) => {
        const cb = (_: string, messageType: string, message: string) => {
            if (messageType === "packages-installation") {
                const { duration } = JSON.parse(message);
                if (duration) {
                    cbListener.delete(cb);
                    resolve();
                }
            }
        };
        cbListener.add(cb);

        // package install quick
        callLib(
            new Uint8Array([...editorHeader, 61, ...serializeArgs([".", 0])])
        );
    });
}

export async function buildLocalProject() {
    const editorHeader = createPayloadHeader({
        id: "",
        isEditor: true
    });

    await quickInstallPacakge(editorHeader);

    return new Promise<void>(async (resolve) => {
        const cb = (_: string, messageType: string, message: string) => {
            if (messageType === "build") {
                cbListener.delete(cb);
                const data = toByteArray(message);
                const [_, errorsStr] = deserializeArgs(data);
                let buildErrors: Message[];
                try {
                    buildErrors = JSON.parse(errorsStr);
                    if (buildErrors === null) {
                        resolve();
                        return;
                    }
                } catch (e) {}
                console.log(buildErrors || errorsStr);
                process.exit(1);
            }
        };
        cbListener.add(cb);

        // build sasss
        await buildSASS({ id: "." } as Project, {
            mkdir: async (p) => {
                await promises.mkdir(p, { recursive: true });
                return true;
            },
            readdir: promises.readdir,
            writeFile: async (p, d) => {
                await promises.writeFile(p, d);
                return true;
            },
            readFile: promises.readFile
        });

        // esbuild build
        callLib(
            new Uint8Array([...editorHeader, 56, ...serializeArgs([".", 0])])
        );
    });
}
