import { Command } from "@fullstacked/terminal"
import esbuild from "../lib/esbuild"

export const npm: Command[] = [
    {
        name: "npm",
        exec: () => {},
        subcommands: [{
            name: "install",
            alias: ["i"],
            exec: (args, it) => {
                args.forEach(p => esbuild.install(p))
            }
        }]
    }
]