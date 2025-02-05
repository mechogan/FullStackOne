import { Command } from "@fullstacked/terminal"
import packages, { PackageInfo } from "../lib/packages"
import c from "console-log-colors"
import prettyMilliseconds from "pretty-ms"
import prettyBytes from "pretty-bytes"

export const npm: Command[] = [
    {
        name: "npm",
        exec: () => { },
        subcommands: [{
            name: "install",
            alias: ["i"],
            exec: async (args, it, ctx) => {
                const result = await packages.install(ctx, args, (p) => {
                    it.clear()
                    it.print(installProgressToText(p))
                })
                it.clear();
                it.println(`installed ${c.bold.green(result.packages.length.toString())} package${result.packages.length > 1 ? "s" : ""} in ${prettyMilliseconds(result.duration)}`)
            }
        }]
    }
]

function installProgressToText(p: PackageInfo[]): string {
    const lines: string[] = []

    const activeInstalls = p
        .filter(({ progress }) => progress.stage != "" && progress.stage != "done")

    let longestNameVersionLength = 0;
    activeInstalls.forEach(({ name, version, progress: { stage } }) => {
        const nameAndVersion = name + version;
        if (nameAndVersion.length > longestNameVersionLength) {
            longestNameVersionLength = nameAndVersion.length
        }
    });

    for (const i of activeInstalls) {
        const nameAndVersion = `${i.name}@${i.version}`.padEnd(longestNameVersionLength + 1, " ");
        const stage = (i.progress.stage || "waiting").padEnd(12); // longest: "downloading"
        lines.push(`${nameAndVersion} ${stage} ${progressBar(i.progress)}`);
    }

    return lines.join("\n");
}

function progressBar(
    p: { loaded: number, total: number, stage: string },
    blocksCount = 10
) {
    const blocks = Math.floor((p.loaded / p.total) * blocksCount);
    let progressBar = "";
    for (let j = 0; j < blocksCount; j++) {
        progressBar += j < blocks ? "=" : " ";
    }

    let percent = "";
    if (p.stage === "downloading" && p.loaded !== 0) {
        percent = `(${prettyBytes(p.loaded)}/${prettyBytes(p.total)})`;
    } else if (p.stage === "unpacking" && p.loaded !== 0) {
        percent = `(${p.loaded}/${p.total})`;
    }

    return `[${progressBar}] ${percent}`;
}