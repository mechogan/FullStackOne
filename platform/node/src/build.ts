import { promises } from "node:fs";
import { buildSASS } from "../../../editor/lib/esbuild/sass";
import type { Project } from "../../../editor/types";
import { createPayloadHeader } from "./instance";
import { callLib } from "./call";
import { serializeArgs } from "../../../lib/bridge/serialization";

export async function buildLocalProject() {
    const editorHeader = createPayloadHeader({
        id: "",
        isEditor: true
    })

    // package install quick
    callLib(new Uint8Array([
        ...editorHeader,
        61,
        ...serializeArgs([".", 0])
    ]));

    // build sasss
    await buildSASS({ id: "." } as Project, {
        mkdir: async (p) => { await promises.mkdir(p, { recursive: true }); return true },
        readdir: promises.readdir,
        writeFile: async (p, d) => { await promises.writeFile(p, d); return true },
        readFile: promises.readFile
    });

    // esbuild build
    callLib(new Uint8Array([
        ...editorHeader,
        56,
        ...serializeArgs([".", 0])
    ]));
}