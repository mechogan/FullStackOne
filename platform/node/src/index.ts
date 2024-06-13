#!/usr/bin/env node
import { fileURLToPath } from "url";
import { InstanceEditor } from "./instanceEditor";
import path from "path";

const launchURL = process.argv.at(-1).match(/^https?:\/\//)
    ? "fullstacked://" + process.argv.at(-1).replace(/:\/\//, "//")
    : null;

const editorInstance = new InstanceEditor(
    launchURL,
    path.dirname(fileURLToPath(import.meta.url))
);
editorInstance.start();
