import git from "isomorphic-git";
import type { fs as globalFS } from "../../../src/api/fs";
import type { fetch as globalFetch } from "../../../src/api/fetch";
import { Buffer as globalBuffer } from "buffer";

declare var fs: typeof globalFS;
declare var fetch: typeof globalFetch;

// for isomorphic-git
globalThis.Buffer = globalBuffer;

async function awaitBody(body: AsyncIterableIterator<Uint8Array>) {
    let size = 0;
    const buffers = [];
    for await (const chunk of body) {
        buffers.push(chunk);
        size += chunk.byteLength;
    }
    const result = new Uint8Array(size);
    let nextIndex = 0;
    for (const buffer of buffers) {
        result.set(buffer, nextIndex);
        nextIndex += buffer.byteLength;
    }
    return result;
}

// https://isomorphic-git.org/docs/en/http
const http = {
    async request({ url, method, headers, body, onProgress }) {
        body = body ? await awaitBody(body) : undefined;

        const response = await fetch(url, {
            method,
            headers,
            body
        });

        return {
            ...response,
            body: [response.body]
        };
    }
};

export default {
    clone(url: string, dir: string) {
        return git.clone({
            fs,
            http,
            dir,
            url,
            singleBranch: true,
            depth: 1
        });
    }
};
