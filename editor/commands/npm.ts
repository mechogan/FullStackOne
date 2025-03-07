import { Command } from "@fullstacked/terminal";
import packages, { PackageInfo } from "../lib/packages";
import c from "console-log-colors";
import prettyMilliseconds from "pretty-ms";
import prettyBytes from "pretty-bytes";
import { Project } from "../types";

export const npm: Command[] = [
    {
        name: "npm",
        exec: () => {},
        subcommands: [
            {
                name: "install",
                alias: ["i"],
                exec: async (args, it, ctx: Project) => {
                    const dev =
                        args.includes("--save-dev") || args.includes("-D");
                    args = args.filter((a) => a !== "--save-dev" && a !== "-D");
                    it.print("getting packages info...");
                    const result = await packages.install(
                        ctx,
                        args,
                        (p) => {
                            it.clear();
                            it.print(installProgressToText(p));
                        },
                        args.includes("--quick"),
                        dev
                    );
                    it.clear();
                    it.println(
                        `installed ${c.bold.green(result.packagesInstalledCount)} package${result.packagesInstalledCount > 1 ? "s" : ""} in ${prettyMilliseconds(result.duration)}`
                    );
                }
            }
        ]
    }
];

function installProgressToText(p: [string, PackageInfo["progress"]][]): string {
    const lines: string[] = [];

    let longestNameVersionLength = 0;
    p.forEach(([name]) => {
        if (name.length > longestNameVersionLength) {
            longestNameVersionLength = name.length;
        }
    });

    for (const [name, progress] of p) {
        const nameAndVersion = `${name}`.padEnd(longestNameVersionLength, " ");
        const stage = (progress.stage || "waiting").padEnd(12); // longest: "downloading"
        lines.push(`${nameAndVersion} ${stage} ${progressBar(progress)}`);
    }

    return lines.join("\n");
}

function progressBar(
    p: { loaded: number; total: number; stage: string },
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
