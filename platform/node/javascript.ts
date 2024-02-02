; import vm from "vm"
import fs from "fs";
import type { fs as fsType } from "../../src/api";
import type { Response } from "../../src/api/index"

export class JavaScript {
    private requestId = 0
    ctx = vm.createContext();

    privileged = false

    constructor(fsdir: string, assetdir: string, entrypoint: string) {
        this.bindFs(fsdir);

        this.ctx.requests = {};
        this.ctx.assetdir = assetdir;
        
        const script = new vm.Script(fs.readFileSync(entrypoint, {encoding: "utf-8"}));
        script.runInContext(this.ctx);
    }

    processRequest(headers: {[headerName: string]: string}, pathname: string, body: Uint8Array) {
        const requestId = this.requestId
        this.requestId += 1;
        
        this.ctx.requests[requestId] = {
            headers,
            pathname,
            body
        }
        
        const script = new vm.Script(`api.default("${requestId}")`);
        return script.runInContext(this.ctx) as Response;
    }

    private bindFs(rootdir: string) {
        const realpath = (path: string) => rootdir + "/" + path;
        const realpathForAsset = (path: string) => this.privileged ? path : realpath(path);

        const ctxFs: typeof fsType = {
            exists(itemPath, forAsset) {
                return fs.existsSync(forAsset ? realpathForAsset(itemPath) : realpath(itemPath))
            },
            mkdir(directory) {
                fs.mkdirSync(realpath(directory), { recursive: true });
            },
            putfile(filename, contents) {
                fs.writeFileSync(realpath(filename), new Uint8Array(contents));
            },
            putfileUTF8(filename, contents) {
                fs.writeFileSync(realpath(filename), contents);
            },
            readdir(directory) {
                return fs.readdirSync(realpath(directory), { withFileTypes: true })
                    .map(item => ({
                        name: item.name,
                        isDirectory: item.isDirectory()
                    }))
            },
            readfile(filename, forAsset) {
                return new Uint8Array(fs.readFileSync(forAsset ? realpathForAsset(filename) : realpath(filename)));
            },
            readfileUTF8(filename) {
                return fs.readFileSync(realpath(filename), { encoding: "utf-8" });
            },
            rm(itemPath) {
                fs.rmSync(realpath(itemPath), { recursive: true });
            }
        }

        this.ctx.fs = ctxFs;
    }
}