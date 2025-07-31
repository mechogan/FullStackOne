import { createTool } from "@fullstacked/ai-agent";
import { z } from "zod";
import fs from "../../fs";

const tools: ReturnType<typeof createTool>[] = [
    createTool({
        name: "CreateDir",
        description: "Create a directory.",
        schema: z.object({
            path: z.string(),
        }),
        fn: ({ path }) => fs.mkdir(path),
        message: ({ path }) => `Creating directory ${path}`,
    }),
    createTool({
        name: "ListFiles",
        description: "List files in a directory.",
        schema: z.object({
            path: z.string(),
        }),
        fn: ({ path }) => fs.readdir(path),
        message: ({ path }) => `Listing files at ${path}`,
    }),
    createTool({
        name: "ReadFile",
        description: "Read the content of a file.",
        schema: z.object({
            path: z.string(),
        }),
        fn: ({ path }) => fs.readFile(path, { encoding: "utf8" }),
        message: ({ path }) => `Reading file at ${path}`,
    }),
    createTool({
        name: "WriteFile",
        description: "Write content to file.",
        schema: z.object({
            path: z.string(),
            contents: z.string(),
        }),
        fn: ({ path, contents }) => fs.writeFile(path, contents),
        message: ({ path }) => `Writing to ${path}`,
    }),
]

export default tools;