import { numberTo4Bytes, serializeArgs } from "../../../src/serialization";
import { callLib } from "./call";

type InstanceOpts = { isEditor: boolean; id: string };

export function createInstance(opts: InstanceOpts) {
    const header = createPayloadHeader(opts);

    const call = (payload: Uint8Array) =>
        callLib(new Uint8Array([...header, ...payload]));

    return {
        ...opts,
        call
    };
}

const te = new TextEncoder();

function createPayloadHeader(opts: InstanceOpts) {
    if (opts.isEditor) {
        return new Uint8Array([
            1, // is editor
            ...numberTo4Bytes(0) // no project id
        ]);
    }

    const idData = te.encode(opts.id);

    return new Uint8Array([
        0, // is not editor
        ...numberTo4Bytes(idData.byteLength), // project id length
        ...idData // project id
    ]);
}
