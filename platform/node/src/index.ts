#!/usr/bin/env node
import open from "open";
import { InstanceEditor } from "./instanceEditor";

const editorInstance = new InstanceEditor();
editorInstance.start();
open(`http://localhost:${editorInstance.port}`);