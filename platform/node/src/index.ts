#!/usr/bin/env node
import { InstanceEditor } from "./instanceEditor";

const launchURL = process.argv.at(-1).match(/^https?:\/\//)
    ? "fullstacked://" + process.argv.at(-1).replace(/:\/\//, "//")
    : null;

const editorInstance = new InstanceEditor(launchURL);
editorInstance.start();
