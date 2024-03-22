import path from "path";
import { Instance } from "./instance";
import { fileURLToPath } from "url";
import type { AdapterEditor } from "../../../editor/rpc";
import os from "os";
import { initAdapter } from "./adapter";
import { Project } from "../../../editor/api/projects/types";
import fs from "fs";
import { build, merge } from "./build";
import esbuild from "esbuild";
import open from "open";
import { WebSocket } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorDirectory = path.resolve(__dirname, "editor");

export class InstanceEditor extends Instance {
    rootDirectory: string = os.homedir();
    baseJS: string = path.resolve(__dirname, "js", "index.js");
    configDirectory: string = ".config/fullstacked";
    nodeModulesDirectory: string = this.configDirectory + "/node_modules";
    cacheDirectory: string = ".cache/fullstacked";

    adapter: AdapterEditor = null;

    launchURL: string;

    constructor(launchURL: string){
        super(editorDirectory);

        this.launchURL = launchURL; 

        const defaultAdapter = initAdapter(editorDirectory);
        this.adapter = {
            ...defaultAdapter,
            fs: {
                ...defaultAdapter.fs,
                readFile: (path, options?: { encoding?: "utf8"; absolutePath?: boolean; }) => {
                    if(options?.absolutePath){
                        return fs.promises.readFile(this.rootDirectory + "/" + path, options);
                    }
                    return defaultAdapter.fs.readFile(path, options);
                },
                writeFile: (file, data, options) => {
                    if(options?.absolutePath){
                        return fs.promises.writeFile(this.rootDirectory + "/" + file, data, options);
                    }
                    return defaultAdapter.fs.writeFile(file, data, options);
                },
                unlink: (path, options) => {
                    if(options?.absolutePath){
                        return fs.promises.unlink(this.rootDirectory + "/" + path);
                    }
                    return defaultAdapter.fs.unlink(path);
                },
                readdir: async (path, options?: { withFileTypes: true, absolutePath?: boolean }) => {
                    if(options?.absolutePath){
                        const items = await fs.promises.readdir(this.rootDirectory + "/" + path, options);
                        if(!options?.withFileTypes)
                            return items;
                        
                        return items.map(item => ({
                            ...item, 
                            isDirectory: item.isDirectory()
                        }))
                    }
                    return defaultAdapter.fs.readdir(path, options);
                },
                mkdir: async (path, options) => {
                    if(options?.absolutePath){
                        await fs.promises.mkdir(this.rootDirectory + "/" + path, { recursive: true });
                        return;
                    }
                    return defaultAdapter.fs.mkdir(path);
                },
                rmdir: (path, options) => {
                    if(options?.absolutePath){
                        return fs.promises.rm(this.rootDirectory + "/" + path, { recursive: true });
                    }
                    return defaultAdapter.fs.rmdir(path);
                },
                stat: async (path, options) => {
                    if(options?.absolutePath){
                        const stats: any = await fs.promises.stat(this.rootDirectory + "/" + path);
                        stats.isDirectory = stats.isDirectory();
                        stats.isFile = stats.isFile();
                        return stats;
                    }
                    return defaultAdapter.fs.stat(path);
                },
                lstat: async (path, options) => {
                    if(options?.absolutePath){
                        const stats: any = await fs.promises.lstat(this.rootDirectory + "/" + path);
                        stats.isDirectory = stats.isDirectory();
                        stats.isFile = stats.isFile();
                        return stats;
                    }
                    return defaultAdapter.fs.lstat(path);
                },
                exists: async (path: string, options?: { absolutePath?: boolean; }) => {
                    if(options?.absolutePath){
                        try{
                            const stats = await fs.promises.stat(this.rootDirectory + "/" + path);
                            return { isFile: stats.isFile() };
                        }catch(e){
                            return null;
                        }
                    }
                    return defaultAdapter.fs.exists(path);
                }
            },

            directories: {
                root: this.rootDirectory,
                cache: this.cacheDirectory,
                config: this.configDirectory,
                nodeModules: this.nodeModulesDirectory
            },

            esbuild: {
                check: () => true,
                install: () => null
            },

            build: async (project: Project) => {
                const entryPoint = [
                    this.rootDirectory + "/" + project.location + "/index.js",
                    this.rootDirectory + "/" + project.location + "/index.jsx"
                ].find(file => fs.existsSync(file));

                if(!entryPoint) return null;

                const mergedFile = await merge(this.baseJS, entryPoint, this.rootDirectory + "/" + this.cacheDirectory);

                const outdir = this.rootDirectory + "/" + project.location + "/.build";
                const result = build(esbuild.buildSync, [{
                    in: mergedFile,
                    out: "index"
                }], outdir, [this.rootDirectory + "/" + this.nodeModulesDirectory]);

                await fs.promises.unlink(mergedFile);

                return result?.errors;
            },
            run: (project: Project) => {
                const instance = new Instance(this.rootDirectory + "/" + project.location);
                instance.start();
            },
            open(project: Project) {
                open(this.rootDirectory + "/" + project.location);
            }
        }
    }
    
    override wsOnConnection(ws: WebSocket): void {
        super.wsOnConnection(ws);
        if(this.launchURL) {
            this.webSockets.forEach(ws => ws.send(JSON.stringify({
                messageType: "launchURL",
                message: this.launchURL
            })));
            this.launchURL = null;
        }
    }
}